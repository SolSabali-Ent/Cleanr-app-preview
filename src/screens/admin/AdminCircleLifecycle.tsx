import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  AdminNotice,
  AdminPanel,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminStatus,
  AdminTableShell,
} from "./AdminUi";

type ReadinessRow = {
  signal_key: string;
  label: string;
  current_value: number;
  target_min: number | null;
  target_max: number | null;
  unit: string;
  target_kind: "founding_target" | "observed_signal";
  detail: string;
  sort_order: number;
};

type HistoryRow = {
  history_id: string;
  from_status: string;
  to_status: string;
  reason: string;
  changed_at: string;
};

type Props = {
  circleId: string;
  circleStatus: string;
  onChanged: () => void | Promise<void>;
};

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function transitionOptions(status: string): string[] {
  if (status === "forming") return ["active", "ended"];
  if (status === "active") return ["paused", "ended"];
  if (status === "paused") return ["active", "ended"];
  return [];
}

export function AdminCircleLifecycle({ circleId, circleStatus, onChanged }: Props) {
  const [readiness, setReadiness] = useState<ReadinessRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [nextStatus, setNextStatus] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const [readinessResult, historyResult] = await Promise.all([
      supabase.rpc("get_admin_circle_pilot_readiness", { p_circle_id: circleId }),
      supabase.rpc("get_admin_circle_lifecycle_history", { p_circle_id: circleId }),
    ]);
    const firstError = readinessResult.error ?? historyResult.error;
    if (firstError) setError(firstError.message);
    setReadiness(readinessResult.error ? [] : (readinessResult.data ?? []) as ReadinessRow[]);
    setHistory(historyResult.error ? [] : (historyResult.data ?? []) as HistoryRow[]);
    setLoading(false);
  }

  useEffect(() => {
    setNextStatus("");
    setReason("");
    void load();
  }, [circleId, circleStatus]);

  const options = useMemo(() => transitionOptions(circleStatus), [circleStatus]);

  async function changeStatus() {
    if (!nextStatus || reason.trim().length < 3 || saving) return;
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("admin_set_cleanr_circle_status", {
      p_circle_id: circleId,
      p_status: nextStatus,
      p_reason: reason.trim(),
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setNextStatus("");
    setReason("");
    await Promise.all([load(), Promise.resolve(onChanged())]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-950">Circle lifecycle</h3>
            <AdminStatus tone={circleStatus === "active" ? "success" : circleStatus === "paused" ? "warning" : "neutral"}>{humanize(circleStatus)}</AdminStatus>
          </div>
          <p className="mt-1 text-xs text-slate-500">Readiness is evidence for a human decision, never an automatic activation score.</p>
        </div>
        <AdminSecondaryButton onClick={() => void load()} disabled={loading}><RefreshCw size={14} /> {loading ? "Refreshing…" : "Refresh"}</AdminSecondaryButton>
      </div>

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          <AdminTableShell>
            <div className="grid grid-cols-[minmax(220px,1fr)_120px_180px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Readiness signal</span><span>Current</span><span>Reference</span>
            </div>
            {loading ? <p className="px-5 py-5 text-sm text-slate-500">Loading readiness signals…</p> : readiness.length === 0 ? <p className="px-5 py-5 text-sm text-slate-500">No readiness signals recorded.</p> : readiness.map((row) => {
              const hasRange = row.target_min != null && row.target_max != null;
              return (
                <div key={row.signal_key} className="grid grid-cols-[minmax(220px,1fr)_120px_180px] items-start gap-4 border-b border-slate-200 px-5 py-4 last:border-b-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{row.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{row.detail}</p>
                  </div>
                  <p className="text-lg font-semibold text-slate-950">{Number(row.current_value).toLocaleString()}</p>
                  <div>
                    <AdminStatus tone={row.target_kind === "founding_target" ? "warning" : "neutral"}>{row.target_kind === "founding_target" ? "Founding target" : "Observed"}</AdminStatus>
                    <p className="mt-2 text-xs text-slate-500">{hasRange ? `${row.target_min}–${row.target_max} ${row.unit}` : row.unit}</p>
                  </div>
                </div>
              );
            })}
          </AdminTableShell>

          <details className="rounded-2xl border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">Lifecycle history · {history.length}</summary>
            <div className="border-t border-slate-200">
              {history.length === 0 ? <p className="px-5 py-4 text-xs text-slate-500">No lifecycle transition has been recorded yet.</p> : history.map((row) => (
                <div key={row.history_id} className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{humanize(row.from_status)} → {humanize(row.to_status)}</p>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">{row.reason}</p>
                  </div>
                  <p className="text-[11px] text-slate-500">{new Date(row.changed_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </details>
        </div>

        <AdminPanel className="h-fit">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Record decision</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">Current status: {humanize(circleStatus)}</p>
          {options.length === 0 ? (
            <p className="mt-3 text-xs leading-5 text-slate-500">Ended Circles are terminal in the current model. History and collective assets remain durable.</p>
          ) : (
            <>
              <label className="mt-4 block text-xs font-semibold text-slate-600">Move to
                <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400">
                  <option value="">Choose status</option>
                  {options.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
                </select>
              </label>
              <label className="mt-3 block text-xs font-semibold text-slate-600">Decision reason
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={4} placeholder="Why this lifecycle change is appropriate now." className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400" />
              </label>
              <div className="mt-4">
                <AdminPrimaryButton disabled={!nextStatus || reason.trim().length < 3 || saving} onClick={() => void changeStatus()}>{saving ? "Saving…" : "Record lifecycle decision"}</AdminPrimaryButton>
              </div>
            </>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
