import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { adminTheme } from "../../theme/adminTheme";

type DrainRun = {
  id: string;
  requested_by: string;
  requested_at: string;
  completed_at: string | null;
  batch_size: number;
  status: "running" | "succeeded" | "failed";
  processor_http_status: number | null;
  claimed_count: number | null;
  sent_count: number | null;
  failed_count: number | null;
  error: string | null;
};

type ReviewerProfile = {
  id: string;
  full_name: string | null;
};

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

export function KinexDrainAuditCard() {
  const [run, setRun] = useState<DrainRun | null>(null);
  const [requestedByName, setRequestedByName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const { data, error: runError } = await supabase
      .from("kinex_outbox_drain_runs")
      .select("id,requested_by,requested_at,completed_at,batch_size,status,processor_http_status,claimed_count,sent_count,failed_count,error")
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runError) {
      setError(runError.message);
      setRun(null);
      setLoading(false);
      return;
    }

    const latest = (data ?? null) as DrainRun | null;
    setRun(latest);
    setRequestedByName(null);

    if (latest?.requested_by) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,full_name")
        .eq("id", latest.requested_by)
        .maybeSingle();
      const profile = (profileData ?? null) as ReviewerProfile | null;
      setRequestedByName(profile?.full_name ?? null);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="mt-4 rounded-lg border p-3" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold" style={{ color: adminTheme.textPrimary }}>Durable drain audit</p>
          <p className="mt-1 text-[11px] leading-4" style={{ color: adminTheme.textSecondary }}>
            Admin-triggered outbox drains leave a durable Cleanr record; transient Edge logs are not the only accountability surface.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="text-[11px] font-semibold underline disabled:opacity-50" style={{ color: adminTheme.primary }}>
          {loading ? "Refreshing…" : "Refresh audit"}
        </button>
      </div>

      {error ? <p className="mt-3 text-xs text-amber-800">Audit read failed: {error}</p> : null}
      {!loading && !error && !run ? (
        <p className="mt-3 text-xs" style={{ color: adminTheme.textSecondary }}>No admin drain has been durably recorded yet.</p>
      ) : null}
      {run ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Outcome</p>
            <p className="text-xs font-semibold" style={{ color: run.status === "succeeded" ? "#15803d" : run.status === "failed" ? "#b91c1c" : adminTheme.textPrimary }}>{run.status}</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Requested by</p>
            <p className="text-xs font-semibold" title={run.requested_by} style={{ color: adminTheme.textPrimary }}>{requestedByName ?? shortId(run.requested_by)}</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Requested</p>
            <p className="text-xs font-semibold" style={{ color: adminTheme.textPrimary }}>{formatTimestamp(run.requested_at)}</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Completed</p>
            <p className="text-xs font-semibold" style={{ color: adminTheme.textPrimary }}>{formatTimestamp(run.completed_at)}</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Batch size</p>
            <p className="text-xs font-semibold" style={{ color: adminTheme.textPrimary }}>{run.batch_size}</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Claimed</p>
            <p className="text-xs font-semibold" style={{ color: adminTheme.textPrimary }}>{run.claimed_count ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Sent</p>
            <p className="text-xs font-semibold" style={{ color: adminTheme.textPrimary }}>{run.sent_count ?? "—"}</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Failed</p>
            <p className="text-xs font-semibold" style={{ color: adminTheme.textPrimary }}>{run.failed_count ?? "—"}</p>
          </div>
        </div>
      ) : null}

      {run?.error ? <p className="mt-3 text-[11px] leading-4 text-red-700">{run.error}{run.processor_http_status ? ` · HTTP ${run.processor_http_status}` : ""}</p> : null}
    </div>
  );
}
