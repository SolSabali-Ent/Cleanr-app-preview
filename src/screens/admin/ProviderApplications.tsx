import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { traceProfileWriteStart, traceProfileWriteResult } from "@/lib/debug/profileWriteTrace";
import { getActivationChecks } from "../../lib/cspActivation";
import { supabase } from "../../lib/supabase";
import { useIsAdmin } from "../../lib/useIsAdmin";
import { adminTheme } from "../../theme/adminTheme";

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
  reviewed_at: string;
};

type ReviewerProfile = {
  id: string;
  full_name: string | null;
};

type ReviewType = "identity" | "background" | "screening";

function approvalReadiness(row: ProviderApplicationRow, providerReviews: VerificationReviewRow[]) {
  const checks = getActivationChecks(
    {
      role: "csp",
      is_onboarded: row.is_onboarded,
      csp_terms_accepted_at: row.csp_terms_accepted_at,
      identity_document_path: row.identity_document_path,
      identity_status: row.identity_status,
      background_check_status: row.background_check_status,
      screening_status: row.screening_status,
      travel_readiness_status: row.travel_readiness_status,
    },
    {
      identityVerifiedReview: providerReviews.some(
        (review) => review.review_type === "identity" && review.outcome === "verified" && review.reviewed_by !== row.id
      ),
      backgroundClearReview: providerReviews.some(
        (review) => review.review_type === "background" && review.outcome === "clear" && review.reviewed_by !== row.id
      ),
    }
  );

  return {
    checks,
    ready: checks.length > 0 && checks.every((check) => check.passed),
    missing: checks.filter((check) => !check.passed).map((check) => check.label),
  };
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function formatReviewTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function ProviderApplications() {
  const { isAdmin, loading: adminLoading, userId } = useIsAdmin();
  const [searchParams] = useSearchParams();
  const focusedProviderId = searchParams.get("provider")?.trim() || null;
  const [rows, setRows] = useState<ProviderApplicationRow[]>([]);
  const [reviews, setReviews] = useState<VerificationReviewRow[]>([]);
  const [reviewerProfiles, setReviewerProfiles] = useState<ReviewerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [workingKey, setWorkingKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);

    let query = supabase
      .from("profiles")
      .select(
        "id,full_name,is_onboarded,application_status,identity_status,insurance_status,background_check_status,screening_status,travel_readiness_status,agreement_accepted_at,csp_terms_accepted_at,application_submitted_at,identity_document_path,insurance_document_path,rejection_reason,cleaning_experience_bucket,has_own_equipment,has_reliable_transportation,provider_review_band,provider_interest_submitted_at"
      )
      .eq("role", "csp");

    if (focusedProviderId) {
      query = query.eq("id", focusedProviderId);
    } else {
      query = query.or("application_status.in.(submitted,under_review),cleaning_experience_bucket.not.is.null");
    }

    const { data, error } = await query
      .order("provider_interest_submitted_at", { ascending: false, nullsFirst: false })
      .order("application_submitted_at", { ascending: false, nullsFirst: false });

    if (error) {
      setMessage(error.message);
      setRows([]);
      setReviews([]);
      setReviewerProfiles([]);
      setLoading(false);
      return;
    }

    const providerRows = (data ?? []) as ProviderApplicationRow[];
    setRows(providerRows);

    const providerIds = providerRows.map((row) => row.id);
    if (providerIds.length === 0) {
      setReviews([]);
      setReviewerProfiles([]);
      setLoading(false);
      return;
    }

    const { data: reviewData, error: reviewError } = await supabase
      .from("provider_verification_reviews")
      .select("id,provider_id,review_type,outcome,note,reviewed_by,reviewed_at")
      .in("provider_id", providerIds)
      .order("reviewed_at", { ascending: false });

    if (reviewError) {
      setMessage(`Provider applications loaded, but review history could not be read: ${reviewError.message}`);
      setReviews([]);
      setReviewerProfiles([]);
      setLoading(false);
      return;
    }

    const reviewRows = (reviewData ?? []) as VerificationReviewRow[];
    setReviews(reviewRows);

    const reviewerIds = [...new Set(reviewRows.map((review) => review.reviewed_by).filter(Boolean))];
    if (reviewerIds.length > 0) {
      const { data: reviewerData } = await supabase
        .from("profiles")
        .select("id,full_name")
        .in("id", reviewerIds);
      setReviewerProfiles((reviewerData ?? []) as ReviewerProfile[]);
    } else {
      setReviewerProfiles([]);
    }

    setLoading(false);
  }

  async function openProviderDocument(path: string | null) {
    if (!path) return;
    const { data, error } = await supabase.storage.from("provider-documents").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      setMessage(error?.message ?? "Could not open provider document.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function reviewEvidence(providerId: string, reviewType: ReviewType, outcome: string) {
    if (providerId === userId) {
      setMessage("Independent reviewer required. Providers cannot review their own verification evidence.");
      return;
    }

    const note = window.prompt(`Optional review note for ${reviewType}`) ?? "";
    const working = `${providerId}:${reviewType}:${outcome}`;
    setWorkingKey(working);
    setMessage(null);

    const rpcArgs = {
      p_provider_id: providerId,
      p_review_type: reviewType,
      p_outcome: outcome,
      p_note: note,
    };
    const traceRpc = await traceProfileWriteStart({
      source: "ProviderApplications.reviewEvidence:admin_set_provider_verification_status",
      operation: "rpc",
      targetId: providerId,
      payload: rpcArgs,
      pathname: "/admin/providers",
    });
    const rpcResult = await supabase.rpc("admin_set_provider_verification_status", rpcArgs);
    traceProfileWriteResult(traceRpc, rpcResult);
    setWorkingKey(null);

    if (rpcResult.error) {
      setMessage(rpcResult.error.message);
      return;
    }

    setMessage(`${reviewType} review recorded: ${outcome}`);
    await load();
  }

  async function updateStatus(providerId: string, status: "under_review" | "rejected") {
    if (providerId === userId) {
      setMessage("Independent reviewer required. Providers cannot change their own application review status.");
      return;
    }

    const reason = status === "rejected" ? window.prompt("Rejection reason") ?? "" : null;
    const rpcArgs = { p_provider_id: providerId, p_status: status, p_reason: reason };
    const traceRpc = await traceProfileWriteStart({
      source: "ProviderApplications.updateStatus:admin_set_application_status",
      operation: "rpc",
      targetId: providerId,
      payload: rpcArgs,
      pathname: "/admin/providers",
    });
    const rpcResult = await supabase.rpc("admin_set_application_status", rpcArgs);
    traceProfileWriteResult(traceRpc, rpcResult);
    if (rpcResult.error) {
      setMessage(rpcResult.error.message);
      return;
    }
    setMessage(`Application updated: ${status}`);
    await load();
  }

  async function approveProvider(providerId: string) {
    if (providerId === userId) {
      setMessage("Independent reviewer required. Providers cannot approve their own application.");
      return;
    }

    const row = rows.find((candidate) => candidate.id === providerId);
    const providerReviews = reviews.filter((review) => review.provider_id === providerId);
    const readiness = row ? approvalReadiness(row, providerReviews) : null;
    if (!readiness?.ready) {
      setMessage(
        readiness?.missing.length
          ? `Approval blocked in UI. Missing: ${readiness.missing.join(", ")}.`
          : "Approval blocked until the provider application is fully review-ready."
      );
      return;
    }

    const rpcArgs = { p_provider_id: providerId };
    const traceRpc = await traceProfileWriteStart({
      source: "ProviderApplications.approveProvider:admin_approve_provider_application",
      operation: "rpc",
      targetId: providerId,
      payload: rpcArgs,
      pathname: "/admin/providers",
    });
    const rpcResult = await supabase.rpc("admin_approve_provider_application", rpcArgs);
    traceProfileWriteResult(traceRpc, rpcResult);
    if (rpcResult.error) {
      setMessage(rpcResult.error.message);
      return;
    }
    setMessage("Provider application approved. Marketplace access remains separately gated.");
    await load();
  }

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, focusedProviderId]);

  const focusedRow = focusedProviderId ? rows.find((row) => row.id === focusedProviderId) ?? null : null;
  const focusedReviews = focusedProviderId ? reviews.filter((review) => review.provider_id === focusedProviderId) : [];
  const focusedReadiness = focusedRow ? approvalReadiness(focusedRow, focusedReviews) : null;
  const reviewerNameById = new Map(reviewerProfiles.map((profile) => [profile.id, profile.full_name]));

  if (adminLoading) {
    return <div className="text-sm" style={{ color: adminTheme.textSecondary }}>Loading admin session...</div>;
  }
  if (!isAdmin) {
    return <div className="text-sm" style={{ color: adminTheme.textSecondary }}>Admin access required.</div>;
  }

  return (
    <main className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>Provider Applications</h1>
        <p className="mt-1 text-sm" style={{ color: adminTheme.textSecondary }}>
          Review provider-submitted evidence, record Cleanr verification outcomes, and approve only when durable application criteria are satisfied.
        </p>
      </header>

      {focusedProviderId ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Focused from pilot queue</p>
              <p className="mt-1 text-sm font-semibold text-amber-950">
                {focusedRow?.full_name ?? "Selected CSP"}
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-900">
                {focusedReadiness
                  ? focusedReadiness.ready
                    ? "All canonical provider-approval prerequisites are satisfied. Approval still requires an independent admin decision; marketplace access remains separate."
                    : `Current approval blockers: ${focusedReadiness.missing.join(", ")}.`
                  : loading
                    ? "Loading the selected CSP’s review truth…"
                    : "The selected CSP could not be loaded from the current admin-visible profile set."}
              </p>
            </div>
            <Link to="/admin/founding-circle" className="text-xs font-semibold text-amber-900 underline">
              Back to Founding Circle
            </Link>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="mb-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface, color: adminTheme.textPrimary }}>
          {message}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading applications...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">{focusedProviderId ? "The selected provider is not available in this admin view." : "No matching providers in the queue."}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const selfReview = Boolean(userId && row.id === userId);
            const trustActionDisabled = workingKey !== null || selfReview;
            const focused = focusedProviderId === row.id;
            const providerReviews = reviews.filter((review) => review.provider_id === row.id);
            const readiness = approvalReadiness(row, providerReviews);
            const approvalDisabled = selfReview || !readiness.ready;

            return (
              <section
                key={row.id}
                className="rounded-xl border p-4"
                style={{
                  borderColor: focused ? "#F2D38A" : adminTheme.border,
                  backgroundColor: focused ? "#FFFDF5" : adminTheme.card,
                }}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{row.full_name ?? row.id}</p>
                      {focused ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">pilot focus</span> : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">status: {row.application_status ?? "draft"}</p>
                    <p className="text-xs text-slate-500">
                      review band: {row.provider_review_band ?? "—"} · interest at: {row.provider_interest_submitted_at ? new Date(row.provider_interest_submitted_at).toLocaleString() : "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      readiness: exp {row.cleaning_experience_bucket ?? "—"} · equipment {row.has_own_equipment === null ? "—" : row.has_own_equipment ? "yes" : "no"} · transport {row.has_reliable_transportation === null ? "—" : row.has_reliable_transportation ? "yes" : "no"}
                    </p>
                    <p className="text-xs text-slate-500">identity: {row.identity_status ?? "not_started"}</p>
                    <p className="text-xs text-slate-500">background: {row.background_check_status ?? "not_started"}</p>
                    <p className="text-xs text-slate-500">screening: {row.screening_status ?? "not_started"}</p>
                    <p className="text-xs text-slate-500">travel: {row.travel_readiness_status ?? "not_started"}</p>
                    <p className="text-xs text-slate-500">CSP terms: {row.csp_terms_accepted_at ? "accepted" : "pending"}</p>
                    <p className="text-xs text-slate-500">insurance (optional): {row.insurance_status ?? "not_started"}</p>
                    {row.rejection_reason ? <p className="text-xs text-red-600">review note: {row.rejection_reason}</p> : null}

                    {selfReview ? (
                      <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
                        <p className="text-xs font-semibold text-amber-900">Independent reviewer required</p>
                        <p className="mt-1 text-xs text-amber-800">
                          You can inspect this application, but you cannot verify evidence, change its review decision, or approve your own CSP application.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Canonical approval readiness</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">Shared app mirror of the database approval boundary. Successful durable reviews are required; profile statuses alone are insufficient.</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${readiness.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                          {readiness.ready ? "Ready for approval" : "Prerequisites missing"}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        {readiness.checks.map((check) => (
                          <p key={check.key} className={`text-xs ${check.passed ? "text-emerald-700" : "text-slate-500"}`}>
                            {check.passed ? "✓" : "○"} {check.label}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-slate-200 p-3">
                      <p className="text-xs font-semibold text-slate-800">Cleanr verification review</p>
                      <div className="mt-2 grid gap-3 md:grid-cols-3">
                        <div>
                          <p className="mb-1 text-xs text-slate-500">Identity</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button disabled={trustActionDisabled} onClick={() => void reviewEvidence(row.id, "identity", "verified")} className="rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">Verify</button>
                            <button disabled={trustActionDisabled} onClick={() => void reviewEvidence(row.id, "identity", "rejected")} className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Reject</button>
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-slate-500">Background</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button disabled={trustActionDisabled} onClick={() => void reviewEvidence(row.id, "background", "clear")} className="rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">Clear</button>
                            <button disabled={trustActionDisabled} onClick={() => void reviewEvidence(row.id, "background", "rejected")} className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Reject</button>
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-slate-500">Screening</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button disabled={trustActionDisabled} onClick={() => void reviewEvidence(row.id, "screening", "completed")} className="rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">Complete</button>
                            <button disabled={trustActionDisabled} onClick={() => void reviewEvidence(row.id, "screening", "waived")} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Waive</button>
                            <button disabled={trustActionDisabled} onClick={() => void reviewEvidence(row.id, "screening", "rejected")} className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-40">Reject</button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Verification audit trail</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">Durable reviewer, outcome, note, and timestamp from provider_verification_reviews.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{providerReviews.length} recorded</span>
                      </div>

                      {providerReviews.length === 0 ? (
                        <p className="mt-3 text-xs leading-5 text-slate-500">No independent verification review has been recorded yet. Current submitted statuses remain evidence awaiting review, not approval proof.</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {providerReviews.map((review) => {
                            const reviewerName = reviewerNameById.get(review.reviewed_by) ?? null;
                            return (
                              <div key={review.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-slate-800">{review.review_type} → {review.outcome}</p>
                                  <p className="text-[11px] text-slate-500">{formatReviewTime(review.reviewed_at)}</p>
                                </div>
                                <p className="mt-1 text-[11px] text-slate-500" title={review.reviewed_by}>
                                  reviewer: {reviewerName ?? shortId(review.reviewed_by)}
                                </p>
                                {review.note?.trim() ? <p className="mt-2 text-xs leading-5 text-slate-700">{review.note}</p> : <p className="mt-2 text-[11px] text-slate-400">No review note recorded.</p>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:max-w-[19rem] lg:justify-end">
                    <button disabled={selfReview} onClick={() => void updateStatus(row.id, "under_review")} className="min-h-[52px] rounded-[14px] border border-slate-300 px-6 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40">Mark under review</button>
                    <button onClick={() => void approveProvider(row.id)} disabled={approvalDisabled} className="min-h-[52px] rounded-[14px] px-6 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" style={{ backgroundColor: adminTheme.success }} title={selfReview ? "Independent reviewer required" : readiness.ready ? "Approve provider application" : `Missing: ${readiness.missing.join(", ")}`}>Approve</button>
                    <button disabled={selfReview} onClick={() => void updateStatus(row.id, "rejected")} className="min-h-[52px] rounded-[14px] px-6 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" style={{ backgroundColor: adminTheme.danger }}>Reject</button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-xs">
                  <span className="text-slate-500">
                    Insurance doc: {row.insurance_document_path ? <button type="button" className="text-blue-600 underline" onClick={() => void openProviderDocument(row.insurance_document_path)}>Open</button> : "—"}
                  </span>
                  <span className="text-slate-500">
                    Identity doc: {row.identity_document_path ? <button type="button" className="text-blue-600 underline" onClick={() => void openProviderDocument(row.identity_document_path)}>Open</button> : "—"}
                  </span>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
