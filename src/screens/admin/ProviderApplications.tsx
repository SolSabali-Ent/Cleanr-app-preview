import { useEffect, useState } from "react";
import { traceProfileWriteStart, traceProfileWriteResult } from "@/lib/debug/profileWriteTrace";
import { supabase } from "../../lib/supabase";
import { useProfile } from "../../lib/useProfile";
import { adminTheme } from "../../theme/adminTheme";

type ProviderApplicationRow = {
  id: string;
  full_name: string | null;
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

function toDocUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("provider-documents").getPublicUrl(path);
  return data.publicUrl;
}

export function ProviderApplications() {
  const { profile } = useProfile();
  const [rows, setRows] = useState<ProviderApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = profile?.role === "admin";

  async function load() {
    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,full_name,application_status,identity_status,insurance_status,background_check_status,screening_status,travel_readiness_status,agreement_accepted_at,csp_terms_accepted_at,application_submitted_at,identity_document_path,insurance_document_path,rejection_reason,cleaning_experience_bucket,has_own_equipment,has_reliable_transportation,provider_review_band,provider_interest_submitted_at"
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

  async function updateStatus(providerId: string, status: "under_review" | "rejected") {
    const reason = status === "rejected" ? window.prompt("Rejection reason") ?? "" : null;
    const rpcArgs = {
      p_provider_id: providerId,
      p_status: status,
      p_reason: reason,
    };
    const traceRpc = await traceProfileWriteStart({
      source: "ProviderApplications.updateStatus:admin_set_application_status",
      operation: "rpc",
      targetId: providerId,
      payload: rpcArgs,
      pathname: "/admin/providers",
    });
    const rpcResult = await supabase.rpc("admin_set_application_status", rpcArgs);
    traceProfileWriteResult(traceRpc, rpcResult);
    const { error } = rpcResult;
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Application updated: ${status}`);
    await load();
  }

  async function approveProvider(providerId: string) {
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
    const { error } = rpcResult;
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Provider approved; marketplace access enabled.");
    await load();
  }

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin]);

  if (!profile) {
    return (
      <div className="text-sm" style={{ color: adminTheme.textSecondary }}>
        Loading admin session...
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="text-sm" style={{ color: adminTheme.textSecondary }}>
        Admin access required.
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>
          Provider Applications
        </h1>
        <p className="mt-1 text-sm" style={{ color: adminTheme.textSecondary }}>
          Review formal applications (submitted / under review) and residential candidate-pool entries (readiness
          captured).
        </p>
      </header>

      {message ? (
        <div
          className="mb-4 rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: adminTheme.border,
            backgroundColor: adminTheme.surface,
            color: adminTheme.textPrimary,
          }}
        >
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
              const insuranceUrl = toDocUrl(row.insurance_document_path);
              const identityUrl = toDocUrl(row.identity_document_path);
              return (
                <section
                  key={row.id}
                  className="rounded-xl border p-4"
                  style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{row.full_name ?? row.id}</p>
                      <p className="mt-1 text-xs text-slate-500">status: {row.application_status ?? "draft"}</p>
                      <p className="text-xs text-slate-500">
                        review band: {row.provider_review_band ?? "—"} · interest at:{" "}
                        {row.provider_interest_submitted_at
                          ? new Date(row.provider_interest_submitted_at).toLocaleString()
                          : "—"}
                      </p>
                      <p className="text-xs text-slate-500">
                        readiness: exp {row.cleaning_experience_bucket ?? "—"} · equipment{" "}
                        {row.has_own_equipment === null ? "—" : row.has_own_equipment ? "yes" : "no"} · transport{" "}
                        {row.has_reliable_transportation === null ? "—" : row.has_reliable_transportation ? "yes" : "no"}
                      </p>
                      <p className="text-xs text-slate-500">insurance: {row.insurance_status ?? "not_started"}</p>
                      <p className="text-xs text-slate-500">identity: {row.identity_status ?? "not_started"}</p>
                      <p className="text-xs text-slate-500">
                        background: {row.background_check_status ?? "not_started"}
                      </p>
                      <p className="text-xs text-slate-500">screening: {row.screening_status ?? "not_started"}</p>
                      <p className="text-xs text-slate-500">
                        travel: {row.travel_readiness_status ?? "not_started"}
                      </p>
                      <p className="text-xs text-slate-500">
                        CSP terms: {row.csp_terms_accepted_at ? "accepted" : "pending"}
                      </p>
                      <p className="text-xs text-slate-500">
                        agreement: {row.agreement_accepted_at ? "accepted" : "pending"}
                      </p>
                      {row.rejection_reason ? (
                        <p className="text-xs text-red-600">rejection: {row.rejection_reason}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => void updateStatus(row.id, "under_review")}
                        className="min-h-[52px] rounded-[14px] border border-slate-300 px-6 text-xs font-medium text-slate-700"
                      >
                        Mark under review
                      </button>
                      <button
                        onClick={() => void approveProvider(row.id)}
                        className="min-h-[52px] rounded-[14px] px-6 text-xs font-semibold text-white"
                        style={{ backgroundColor: adminTheme.success }}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => void updateStatus(row.id, "rejected" as const)}
                        className="min-h-[52px] rounded-[14px] px-6 text-xs font-semibold text-white"
                        style={{ backgroundColor: adminTheme.danger }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-xs">
                    <span className="text-slate-500">
                      Insurance doc:{" "}
                      {insuranceUrl ? (
                        <a className="text-blue-600 underline" href={insuranceUrl} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="text-slate-500">
                      Identity doc:{" "}
                      {identityUrl ? (
                        <a className="text-blue-600 underline" href={identityUrl} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
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
