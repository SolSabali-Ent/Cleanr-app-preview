import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";

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
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Founding pilot readiness</p>
          <h3 className="mt-1 font-semibold text-slate-950">Lifecycle is a deliberate operating decision</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            Readiness signals describe the Circle as it exists today. They do not produce a score, pass/fail result, or automatic activation.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}

      {loading ? <p className="mt-4 text-sm text-slate-500">Loading readiness signals…</p> : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {readiness.map((row) => {
            const hasRange = row.target_min != null && row.target_max != null;
            return (
              <div key={row.signal_key} className={`rounded-xl border p-3 ${row.target_kind === "founding_target" ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-800">{row.label}</p>
                  <span className="shrink-0 text-lg font-bold text-slate-950">{Number(row.current_value).toLocaleString()}</span>
                </div>
                {hasRange ? <p className="mt-1 text-[10px] font-semibold text-amber-700">Founding target: {row.target_min}–{row.target_max} {row.unit}</p> : <p className="mt-1 text-[10px] font-semibold text-slate-500">Observed signal</p>}
                <p className="mt-2 text-[10px] leading-4 text-slate-500">{row.detail}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 grid gap-4 border-t border-slate-200 pt-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,420px)]">
        <div>
          <p className="text-xs font-semibold text-slate-700">Lifecycle history</p>
          {history.length === 0 ? <p className="mt-2 text-xs text-slate-500">No lifecycle transition has been recorded yet.</p> : (
            <div className="mt-2 space-y-2">
              {history.map((row) => (
                <div key={row.history_id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">{humanize(row.from_status)} → {humanize(row.to_status)}</p>
                    <p className="text-[10px] text-slate-500">{new Date(row.changed_at).toLocaleString()}</p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{row.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-700">Current status: {humanize(circleStatus)}</p>
          {options.length === 0 ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">Ended Circles are terminal in the current lifecycle model. History and collective assets remain durable.</p>
          ) : (
            <>
              <label className="mt-3 block text-xs font-semibold text-slate-600">Move to
                <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900">
                  <option value="">Choose status</option>
                  {options.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
                </select>
              </label>
              <label className="mt-3 block text-xs font-semibold text-slate-600">Decision reason
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} placeholder="Why this lifecycle change is appropriate now." className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900" />
              </label>
              <button type="button" disabled={!nextStatus || reason.trim().length < 3 || saving} onClick={() => void changeStatus()} className="mt-3 w-full rounded-lg bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? "Saving…" : "Record lifecycle decision"}
              </button>
              <p className="mt-2 text-[10px] leading-4 text-slate-500">Status changes are human decisions. Readiness signals never trigger this action automatically.</p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
