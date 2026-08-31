import { useEffect, useState } from "react";
import { traceProfileWriteStart, traceProfileWriteResult } from "@/lib/debug/profileWriteTrace";
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

type ReviewType = "identity" | "background" | "screening";

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function inSet(value: string | null | undefined, values: readonly string[]): boolean {
  return values.includes(norm(value));
}

function approvalReadiness(row: ProviderApplicationRow) {
  const checks = [
    { label: "Onboarding", pass: row.is_onboarded === true },
    { label: "CSP terms", pass: Boolean(row.csp_terms_accepted_at) },
    { label: "Identity document", pass: Boolean(row.identity_document_path?.trim()) },
    { label: "Identity verified", pass: inSet(row.identity_status, ["verified", "approved", "completed"]) },
    { label: "Background cleared", pass: inSet(row.background_check_status, ["approved", "verified", "clear"]) },
    { label: "Screening ready", pass: inSet(row.screening_status, ["scheduled", "completed", "waived"]) },
    { label: "Transportation submitted", pass: inSet(row.travel_readiness_status, ["submitted", "completed"]) },
  ];

  return {
    checks,
    ready: checks.every((check) => check.pass),
    missing: checks.filter((check) => !check.pass).map((check) => check.label),
  };
}

export function ProviderApplications() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [rows, setRows] = useState<ProviderApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [workingKey, setWorkingKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,full_name,is_onboarded,application_status,identity_status,insurance_status,background_check_status,screening_status,travel_readiness_status,agreement_accepted_at,csp_terms_accepted_at,application_submitted_at,identity_document_path,insurance_document_path,rejection_reason,cleaning_experience_bucket,has_own_equipment,has_reliable_transportation,provider_review_band,provider_interest_submitted_at"
      )
      .eq("role", "csp")
      .or("application_status.in.(submitted,under_review),not.cleaning_experience_bucket.is.null")
      .order("provider_interest_submitted_at", { ascending: false, nullsFirst: false })
      .order("application_submitted_at", { ascending: false, nullsFirst: false });
    if (error) {
      setMessage(error.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as ProviderApplicationRow[]);
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
    const row = rows.find((candidate) => candidate.id === providerId);
    const readiness = row ? approvalReadiness(row) : null;
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
  }, [isAdmin]);

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

      {message ? (
        <div className="mb-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface, color: adminTheme.textPrimary }}>
          {message}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading applications...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No matching providers in the queue.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const readiness = approvalReadiness(row);
            return (
              <section key={row.id} className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{row.full_name ?? row.id}</p>
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

                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-slate-800">Approval readiness</p>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${readiness.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                          {readiness.ready ? "Ready for approval" : "Prerequisites missing"}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-1 sm:grid-cols-2">
                        {readiness.checks.map((check) => (
                          <p key={check.label} className={`text-xs ${check.pass ? "text-emerald-700" : "text-slate-500"}`}>
                            {check.pass ? "✓" : "○"} {check.label}
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
                            <button disabled={workingKey !== null} onClick={() => void reviewEvidence(row.id, "identity", "verified")} className="rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:opacity-40">Verify</button>
                            <button disabled={workingKey !== null} onClick={() => void reviewEvidence(row.id, "identity", "rejected")} className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-40">Reject</button>
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-slate-500">Background</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button disabled={workingKey !== null} onClick={() => void reviewEvidence(row.id, "background", "clear")} className="rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:opacity-40">Clear</button>
                            <button disabled={workingKey !== null} onClick={() => void reviewEvidence(row.id, "background", "rejected")} className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-40">Reject</button>
                          </div>
                        </div>
                        <div>
                          <p className="mb-1 text-xs text-slate-500">Screening</p>
                          <div className="flex flex-wrap gap-1.5">
                            <button disabled={workingKey !== null} onClick={() => void reviewEvidence(row.id, "screening", "completed")} className="rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-700 disabled:opacity-40">Complete</button>
                            <button disabled={workingKey !== null} onClick={() => void reviewEvidence(row.id, "screening", "waived")} className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-40">Waive</button>
                            <button disabled={workingKey !== null} onClick={() => void reviewEvidence(row.id, "screening", "rejected")} className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-700 disabled:opacity-40">Reject</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:max-w-[19rem] lg:justify-end">
                    <button onClick={() => void updateStatus(row.id, "under_review")} className="min-h-[52px] rounded-[14px] border border-slate-300 px-6 text-xs font-medium text-slate-700">Mark under review</button>
                    <button onClick={() => void approveProvider(row.id)} disabled={!readiness.ready} className="min-h-[52px] rounded-[14px] px-6 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40" style={{ backgroundColor: adminTheme.success }} title={readiness.ready ? "Approve provider application" : `Missing: ${readiness.missing.join(", ")}`}>Approve</button>
                    <button onClick={() => void updateStatus(row.id, "rejected")} className="min-h-[52px] rounded-[14px] px-6 text-xs font-semibold text-white" style={{ backgroundColor: adminTheme.danger }}>Reject</button>
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
