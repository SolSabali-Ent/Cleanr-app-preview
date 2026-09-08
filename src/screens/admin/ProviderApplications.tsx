import { useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { traceProfileWriteStart, traceProfileWriteResult } from "@/lib/debug/profileWriteTrace";
import { getActivationChecks, getProviderApprovalReviewEvidence } from "../../lib/cspActivation";
import { supabase } from "../../lib/supabase";
import { useIsAdmin } from "../../lib/useIsAdmin";
import {
  AdminDangerButton,
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminStatus,
  AdminTabs,
} from "./AdminUi";

type ProviderApplicationRow = {
  id: string;
  full_name: string | null;
  is_onboarded: boolean | null;
  application_status: string | null;
  identity_status: string | null;
  insurance_status: string | null;
  background_check_status: string | null;
  screening_status: string | null;
  travel_readiness_status: string | null;
  agreement_accepted_at: string | null;
  csp_terms_accepted_at: string | null;
  application_submitted_at: string | null;
  identity_document_path: string | null;
  insurance_document_path: string | null;
  rejection_reason: string | null;
  cleaning_experience_bucket: string | null;
  has_own_equipment: boolean | null;
  has_reliable_transportation: boolean | null;
  provider_review_band: string | null;
  provider_interest_submitted_at: string | null;
};

type VerificationReviewRow = {
  id: string;
  provider_id: string;
  review_type: string;
  outcome: string;
  note: string | null;
  reviewed_by: string;
  reviewed_by_display_name: string | null;
  reviewed_at: string;
  reviewed_evidence_ref: string | null;
};

type ApplicationDecisionRow = {
  id: string;
  provider_id: string;
  decision: "approved" | "rejected";
  reason: string | null;
  decided_by: string;
  decided_by_display_name: string | null;
  decided_at: string;
};

type ReviewerProfile = { id: string; full_name: string | null };
type ReviewType = "identity" | "background" | "screening";
type QueueView = "queue" | "ready" | "all";

function approvalReadiness(row: ProviderApplicationRow, providerReviews: VerificationReviewRow[]) {
  const reviewEvidence = getProviderApprovalReviewEvidence({ id: row.id, identity_document_path: row.identity_document_path }, providerReviews);
  const checks = getActivationChecks(
    {
      id: row.id,
      role: "csp",
      is_onboarded: row.is_onboarded,
      csp_terms_accepted_at: row.csp_terms_accepted_at,
      identity_document_path: row.identity_document_path,
      identity_status: row.identity_status,
      background_check_status: row.background_check_status,
      screening_status: row.screening_status,
      travel_readiness_status: row.travel_readiness_status,
    },
    reviewEvidence
  );
  return { checks, ready: checks.length > 0 && checks.every((check) => check.passed), missing: checks.filter((check) => !check.passed).map((check) => check.label) };
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function formatReviewTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusTone(status: string | null) {
  if (status === "approved") return "success" as const;
  if (status === "rejected") return "danger" as const;
  if (status === "submitted" || status === "under_review") return "warning" as const;
  return "neutral" as const;
}

export function ProviderApplications() {
  const { isAdmin, loading: adminLoading, userId } = useIsAdmin();
  const [searchParams] = useSearchParams();
  const focusedProviderId = searchParams.get("provider")?.trim() || null;
  const [rows, setRows] = useState<ProviderApplicationRow[]>([]);
  const [reviews, setReviews] = useState<VerificationReviewRow[]>([]);
  const [decisions, setDecisions] = useState<ApplicationDecisionRow[]>([]);
  const [reviewerProfiles, setReviewerProfiles] = useState<ReviewerProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(focusedProviderId);
  const [view, setView] = useState<QueueView>("queue");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [workingKey, setWorkingKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);

    let query = supabase
      .from("profiles")
      .select("id,full_name,is_onboarded,application_status,identity_status,insurance_status,background_check_status,screening_status,travel_readiness_status,agreement_accepted_at,csp_terms_accepted_at,application_submitted_at,identity_document_path,insurance_document_path,rejection_reason,cleaning_experience_bucket,has_own_equipment,has_reliable_transportation,provider_review_band,provider_interest_submitted_at")
      .eq("role", "csp");

    if (focusedProviderId) query = query.eq("id", focusedProviderId);
    else query = query.or("application_status.in.(submitted,under_review),cleaning_experience_bucket.not.is.null");

    const { data, error } = await query
      .order("provider_interest_submitted_at", { ascending: false, nullsFirst: false })
      .order("application_submitted_at", { ascending: false, nullsFirst: false });

    if (error) {
      setMessage(error.message); setRows([]); setReviews([]); setDecisions([]); setReviewerProfiles([]); setLoading(false); return;
    }

    const providerRows = (data ?? []) as ProviderApplicationRow[];
    setRows(providerRows);
    setSelectedId((current) => focusedProviderId || (current && providerRows.some((row) => row.id === current) ? current : providerRows[0]?.id ?? null));

    const providerIds = providerRows.map((row) => row.id);
    if (providerIds.length === 0) {
      setReviews([]); setDecisions([]); setReviewerProfiles([]); setLoading(false); return;
    }

    const [reviewResult, decisionResult] = await Promise.all([
      supabase.from("provider_verification_reviews").select("id,provider_id,review_type,outcome,note,reviewed_by,reviewed_by_display_name,reviewed_at,reviewed_evidence_ref").in("provider_id", providerIds).order("reviewed_at", { ascending: false }),
      supabase.from("provider_application_decisions").select("id,provider_id,decision,reason,decided_by,decided_by_display_name,decided_at").in("provider_id", providerIds).order("decided_at", { ascending: false }),
    ]);

    if (reviewResult.error || decisionResult.error) {
      const pieces = [reviewResult.error ? `verification history: ${reviewResult.error.message}` : null, decisionResult.error ? `application decision history: ${decisionResult.error.message}` : null].filter(Boolean);
      setMessage(`Applications loaded, but audit history could not be fully read: ${pieces.join(" · ")}`);
    }

    const reviewRows = reviewResult.error ? [] : ((reviewResult.data ?? []) as VerificationReviewRow[]);
    const decisionRows = decisionResult.error ? [] : ((decisionResult.data ?? []) as ApplicationDecisionRow[]);
    setReviews(reviewRows); setDecisions(decisionRows);

    const actorIds = [...new Set([...reviewRows.map((review) => review.reviewed_by).filter(Boolean), ...decisionRows.map((decision) => decision.decided_by).filter(Boolean)])];
    if (actorIds.length > 0) {
      const { data: reviewerData } = await supabase.from("profiles").select("id,full_name").in("id", actorIds);
      setReviewerProfiles((reviewerData ?? []) as ReviewerProfile[]);
    } else setReviewerProfiles([]);
    setLoading(false);
  }

  async function openProviderDocument(path: string | null) {
    if (!path) return;
    const { data, error } = await supabase.storage.from("provider-documents").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) return setMessage(error?.message ?? "Could not open provider document.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function reviewEvidence(providerId: string, reviewType: ReviewType, outcome: string) {
    if (providerId === userId) return setMessage("Independent reviewer required. Providers cannot review their own verification evidence.");
    const note = window.prompt(`Optional review note for ${reviewType}`) ?? "";
    const working = `${providerId}:${reviewType}:${outcome}`;
    setWorkingKey(working); setMessage(null);
    const rpcArgs = { p_provider_id: providerId, p_review_type: reviewType, p_outcome: outcome, p_note: note };
    const traceRpc = await traceProfileWriteStart({ source: "ProviderApplications.reviewEvidence:admin_set_provider_verification_status", operation: "rpc", targetId: providerId, payload: rpcArgs, pathname: "/admin/providers" });
    const rpcResult = await supabase.rpc("admin_set_provider_verification_status", rpcArgs);
    traceProfileWriteResult(traceRpc, rpcResult); setWorkingKey(null);
    if (rpcResult.error) return setMessage(rpcResult.error.message);
    setMessage(`${reviewType} review recorded: ${outcome}`); await load();
  }

  async function updateStatus(providerId: string, status: "under_review" | "rejected") {
    if (providerId === userId) return setMessage("Independent reviewer required. Providers cannot change their own application review status.");
    const reason = status === "rejected" ? window.prompt("Rejection reason") ?? "" : null;
    const rpcArgs = { p_provider_id: providerId, p_status: status, p_reason: reason };
    const traceRpc = await traceProfileWriteStart({ source: "ProviderApplications.updateStatus:admin_set_application_status", operation: "rpc", targetId: providerId, payload: rpcArgs, pathname: "/admin/providers" });
    const rpcResult = await supabase.rpc("admin_set_application_status", rpcArgs);
    traceProfileWriteResult(traceRpc, rpcResult);
    if (rpcResult.error) return setMessage(rpcResult.error.message);
    setMessage(`Application updated: ${status}`); await load();
  }

  async function approveProvider(providerId: string) {
    if (providerId === userId) return setMessage("Independent reviewer required. Providers cannot approve their own application.");
    const row = rows.find((candidate) => candidate.id === providerId);
    const providerReviews = reviews.filter((review) => review.provider_id === providerId);
    const readiness = row ? approvalReadiness(row, providerReviews) : null;
    if (!readiness?.ready) return setMessage(readiness?.missing.length ? `Approval blocked. Missing: ${readiness.missing.join(", ")}.` : "Approval blocked until the application is review-ready.");

    const rpcArgs = { p_provider_id: providerId };
    const traceRpc = await traceProfileWriteStart({ source: "ProviderApplications.approveProvider:admin_approve_provider_application", operation: "rpc", targetId: providerId, payload: rpcArgs, pathname: "/admin/providers" });
    const rpcResult = await supabase.rpc("admin_approve_provider_application", rpcArgs);
    traceProfileWriteResult(traceRpc, rpcResult);
    if (rpcResult.error) return setMessage(rpcResult.error.message);
    setMessage("Provider application approved. Marketplace access remains separately gated."); await load();
  }

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin, focusedProviderId]);

  const reviewerNameById = useMemo(() => new Map(reviewerProfiles.map((profile) => [profile.id, profile.full_name])), [reviewerProfiles]);
  const readinessById = useMemo(() => new Map(rows.map((row) => [row.id, approvalReadiness(row, reviews.filter((review) => review.provider_id === row.id))])), [rows, reviews]);
  const visibleRows = useMemo(() => rows.filter((row) => {
    if (view === "all") return true;
    const readiness = readinessById.get(row.id);
    if (view === "ready") return Boolean(readiness?.ready) && row.application_status !== "approved";
    return ["submitted", "under_review"].includes(row.application_status ?? "") || Boolean(row.cleaning_experience_bucket);
  }), [rows, view, readinessById]);
  const selected = rows.find((row) => row.id === selectedId) ?? visibleRows[0] ?? null;
  const selectedReviews = selected ? reviews.filter((review) => review.provider_id === selected.id) : [];
  const selectedDecisions = selected ? decisions.filter((decision) => decision.provider_id === selected.id) : [];
  const selectedReadiness = selected ? readinessById.get(selected.id) ?? null : null;

  if (adminLoading) return <p className="text-sm text-slate-500">Loading admin session…</p>;
  if (!isAdmin) return <p className="text-sm text-slate-500">Admin access required.</p>;

  return (
    <AdminPage width="full">
      <AdminPageHeader
        eyebrow="People"
        title="Provider applications"
        description="Review evidence, clear approval blockers, and make an independent application decision."
        actions={<AdminSecondaryButton onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</AdminSecondaryButton>}
      />

      {focusedProviderId ? <AdminNotice tone="warning">Focused from Founding Circle. <Link to="/admin/founding-circle" className="font-semibold underline">Back to Founding Circle</Link></AdminNotice> : null}
      {message ? <AdminNotice>{message}</AdminNotice> : null}

      <AdminTabs
        value={view}
        onChange={setView}
        items={[
          { value: "queue", label: "Review queue", count: rows.filter((row) => ["submitted", "under_review"].includes(row.application_status ?? "") || Boolean(row.cleaning_experience_bucket)).length },
          { value: "ready", label: "Ready to approve", count: rows.filter((row) => readinessById.get(row.id)?.ready && row.application_status !== "approved").length },
          { value: "all", label: "All", count: rows.length },
        ]}
      />

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading applications…</div>
      ) : rows.length === 0 ? (
        <AdminEmptyState title={focusedProviderId ? "Selected provider is not available" : "No providers in the review queue"} />
      ) : (
        <div className="grid min-h-[680px] overflow-hidden rounded-2xl border border-slate-200 bg-white xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-r border-slate-200 bg-slate-50/60">
            <div className="border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{visibleRows.length} in view</div>
            <div className="max-h-[760px] overflow-y-auto">
              {visibleRows.map((row) => {
                const readiness = readinessById.get(row.id);
                const active = selected?.id === row.id;
                return (
                  <button key={row.id} type="button" onClick={() => setSelectedId(row.id)} className={`w-full border-b border-slate-200 px-4 py-4 text-left transition ${active ? "bg-white" : "hover:bg-white/70"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">{row.full_name ?? shortId(row.id)}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.cleaning_experience_bucket ?? "Experience not set"}</p>
                      </div>
                      <AdminStatus tone={readiness?.ready ? "success" : statusTone(row.application_status)}>{readiness?.ready ? "Ready" : row.application_status ?? "Draft"}</AdminStatus>
                    </div>
                    {readiness && !readiness.ready ? <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-500">Missing: {readiness.missing.slice(0, 3).join(", ")}</p> : null}
                  </button>
                );
              })}
            </div>
          </aside>

          {selected ? (
            <section className="min-w-0 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold text-slate-950">{selected.full_name ?? selected.id}</h2>
                    <AdminStatus tone={statusTone(selected.application_status)}>{selected.application_status ?? "Draft"}</AdminStatus>
                    {selectedReadiness?.ready ? <AdminStatus tone="success">Ready to approve</AdminStatus> : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Interest {selected.provider_interest_submitted_at ? formatReviewTime(selected.provider_interest_submitted_at) : "—"} · review band {selected.provider_review_band ?? "—"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <AdminSecondaryButton disabled={selected.id === userId} onClick={() => void updateStatus(selected.id, "under_review")}>Mark under review</AdminSecondaryButton>
                  <AdminPrimaryButton disabled={selected.id === userId || !selectedReadiness?.ready} onClick={() => void approveProvider(selected.id)}>Approve</AdminPrimaryButton>
                  <AdminDangerButton disabled={selected.id === userId} onClick={() => void updateStatus(selected.id, "rejected")}>Reject</AdminDangerButton>
                </div>
              </div>

              {selected.id === userId ? <div className="mt-4"><AdminNotice tone="warning">Independent reviewer required. You can inspect this application but cannot review or approve your own CSP application.</AdminNotice></div> : null}

              <div className="mt-5 grid gap-5 2xl:grid-cols-[1fr_1fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approval readiness</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(selectedReadiness?.checks ?? []).map((check) => (
                      <div key={check.key} className={`rounded-lg border px-3 py-2 text-xs ${check.passed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{check.passed ? "✓" : "○"} {check.label}</div>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div><p className="text-slate-400">Equipment</p><p className="mt-1 font-medium text-slate-900">{selected.has_own_equipment === null ? "—" : selected.has_own_equipment ? "Yes" : "No"}</p></div>
                    <div><p className="text-slate-400">Transportation</p><p className="mt-1 font-medium text-slate-900">{selected.has_reliable_transportation === null ? "—" : selected.has_reliable_transportation ? "Yes" : "No"}</p></div>
                    <div><p className="text-slate-400">Insurance</p><p className="mt-1 font-medium capitalize text-slate-900">{selected.insurance_status ?? "Not started"}</p></div>
                    <div><p className="text-slate-400">Travel readiness</p><p className="mt-1 font-medium capitalize text-slate-900">{selected.travel_readiness_status ?? "Not started"}</p></div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification</p>
                  <div className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">
                    {([
                      ["identity", "Identity", selected.identity_status ?? "not started", [["verified", "Verify"], ["rejected", "Reject"]]],
                      ["background", "Background", selected.background_check_status ?? "not started", [["clear", "Clear"], ["rejected", "Reject"]]],
                      ["screening", "Screening", selected.screening_status ?? "not started", [["completed", "Complete"], ["waived", "Waive"], ["rejected", "Reject"]]],
                    ] as Array<[ReviewType, string, string, Array<[string, string]>]>).map(([type, label, status, actions]) => (
                      <div key={type} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <div><p className="text-sm font-medium text-slate-900">{label}</p><p className="mt-0.5 text-xs capitalize text-slate-500">{status.replaceAll("_", " ")}</p></div>
                        <div className="flex gap-1.5">{actions.map(([outcome, actionLabel]) => <button key={outcome} disabled={workingKey !== null || selected.id === userId} onClick={() => void reviewEvidence(selected.id, type, outcome)} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${outcome === "rejected" ? "border-red-200 text-red-700" : "border-slate-200 text-slate-700"}`}>{actionLabel}</button>)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs">
                    {selected.identity_document_path ? <button type="button" onClick={() => void openProviderDocument(selected.identity_document_path)} className="inline-flex items-center gap-1 font-semibold text-[#0000FE] hover:underline">Identity document <ExternalLink className="h-3 w-3" /></button> : <span className="text-slate-400">No identity document</span>}
                    {selected.insurance_document_path ? <button type="button" onClick={() => void openProviderDocument(selected.insurance_document_path)} className="inline-flex items-center gap-1 font-semibold text-[#0000FE] hover:underline">Insurance document <ExternalLink className="h-3 w-3" /></button> : null}
                  </div>
                </div>
              </div>

              {selected.rejection_reason ? <div className="mt-5"><AdminNotice tone="danger">Current rejection note: {selected.rejection_reason}</AdminNotice></div> : null}

              <div className="mt-6 grid gap-3 xl:grid-cols-2">
                <details className="rounded-xl border border-slate-200 bg-white">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-950">Verification history · {selectedReviews.length}</summary>
                  <div className="border-t border-slate-200 px-4 py-3">
                    {selectedReviews.length === 0 ? <p className="text-xs text-slate-500">No verification reviews recorded.</p> : selectedReviews.map((review) => {
                      const reviewerName = review.reviewed_by_display_name?.trim() || reviewerNameById.get(review.reviewed_by) || shortId(review.reviewed_by);
                      const identityEvidenceCurrent = review.review_type === "identity" && review.reviewed_evidence_ref != null && review.reviewed_evidence_ref === selected.identity_document_path;
                      return <div key={review.id} className="border-b border-slate-100 py-3 text-xs last:border-b-0"><div className="flex justify-between gap-3"><p className="font-semibold capitalize text-slate-900">{review.review_type} → {review.outcome}</p><p className="text-slate-400">{formatReviewTime(review.reviewed_at)}</p></div><p className="mt-1 text-slate-500">Reviewer: {reviewerName}</p>{review.review_type === "identity" ? <p className={`mt-1 ${identityEvidenceCurrent ? "text-emerald-700" : "text-amber-700"}`}>{identityEvidenceCurrent ? "Matches current ID evidence" : "Historical ID evidence"}</p> : null}{review.note ? <p className="mt-2 leading-5 text-slate-600">{review.note}</p> : null}</div>;
                    })}
                  </div>
                </details>

                <details className="rounded-xl border border-slate-200 bg-white">
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-950">Decision history · {selectedDecisions.length}</summary>
                  <div className="border-t border-slate-200 px-4 py-3">
                    {selectedDecisions.length === 0 ? <p className="text-xs text-slate-500">No final decision recorded.</p> : selectedDecisions.map((decision) => {
                      const actorName = decision.decided_by_display_name?.trim() || reviewerNameById.get(decision.decided_by) || shortId(decision.decided_by);
                      return <div key={decision.id} className="border-b border-slate-100 py-3 text-xs last:border-b-0"><div className="flex justify-between gap-3"><AdminStatus tone={decision.decision === "approved" ? "success" : "danger"}>{decision.decision}</AdminStatus><p className="text-slate-400">{formatReviewTime(decision.decided_at)}</p></div><p className="mt-1 text-slate-500">By {actorName}</p>{decision.reason ? <p className="mt-2 leading-5 text-slate-600">{decision.reason}</p> : null}</div>;
                    })}
                  </div>
                </details>
              </div>
            </section>
          ) : <div className="p-8"><AdminEmptyState title="Select an application" /></div>}
        </div>
      )}
    </AdminPage>
  );
}
