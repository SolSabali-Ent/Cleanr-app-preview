import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";

type SignalOption = {
  signalId: string;
  label: string;
  status: string;
};

type DemandAction = {
  action_id: string;
  signal_id: string;
  signal_label: string;
  signal_status: string;
  action_type: string;
  action_summary: string;
  action_ref: string | null;
  growth_opportunity_id: string | null;
  growth_opportunity_title: string | null;
  created_at: string;
};

type StatusHistory = {
  history_id: string;
  signal_id: string;
  signal_label: string;
  from_status: string | null;
  to_status: string;
  changed_at: string;
};

const ACTION_TYPES = [
  "external_action",
  "internal_experiment",
  "partnership_exploration",
  "procurement_test",
  "other",
] as const;

function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AdminDemandActionEvidence({
  circleId,
  signals,
  onRecorded,
}: {
  circleId: string;
  signals: SignalOption[];
  onRecorded: () => Promise<void>;
}) {
  const [actions, setActions] = useState<DemandAction[]>([]);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [signalId, setSignalId] = useState("");
  const [actionType, setActionType] = useState<string>("external_action");
  const [summary, setSummary] = useState("");
  const [actionRef, setActionRef] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const actionableSignals = useMemo(
    () => signals.filter((signal) => ["validated", "exploring", "acted"].includes(signal.status)),
    [signals]
  );

  async function load() {
    if (!circleId) {
      setActions([]);
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const [actionsResult, historyResult] = await Promise.all([
      supabase.rpc("get_admin_circle_demand_actions", { p_circle_id: circleId }),
      supabase.rpc("get_admin_circle_demand_status_history", { p_circle_id: circleId }),
    ]);
    const firstError = actionsResult.error ?? historyResult.error;
    if (firstError) {
      setError(firstError.message);
      setActions([]);
      setHistory([]);
    } else {
      setActions((actionsResult.data ?? []) as DemandAction[]);
      setHistory((historyResult.data ?? []) as StatusHistory[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    setSignalId((current) => current && actionableSignals.some((signal) => signal.signalId === current)
      ? current
      : (actionableSignals[0]?.signalId ?? ""));
  }, [circleId, actionableSignals]);

  useEffect(() => { void load(); }, [circleId]);

  async function recordAction() {
    if (!signalId || summary.trim().length < 3 || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const { error: rpcError } = await supabase.rpc("admin_record_circle_demand_action", {
      p_signal_id: signalId,
      p_action_type: actionType,
      p_action_summary: summary.trim(),
      p_action_ref: actionRef.trim() || null,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSummary("");
    setActionRef("");
    setSuccess("Demand action recorded. The signal is now acted because durable evidence exists.");
    await Promise.all([load(), onRecorded()]);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Demand action provenance</p>
          <h2 className="mt-1 font-semibold text-slate-950">What actually happened after a need was validated</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            A signal is only “acted” when Cleanr has durable action evidence. Creating a Growth opportunity records its own action automatically; other experiments, partnerships, procurement tests, or external actions can be recorded here.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error ? <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="mx-5 mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}

      <div className="grid xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="border-b border-slate-200 xl:border-b-0 xl:border-r">
          {loading ? <p className="p-5 text-sm text-slate-500">Loading action evidence…</p> : actions.length === 0 ? (
            <div className="p-6 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">No demand action recorded yet.</p><p className="mt-1 text-xs text-slate-500">Validated demand can remain unacted until something concrete actually happens.</p></div>
          ) : (
            <div className="divide-y divide-slate-100">{actions.map((action) => (
              <div key={action.action_id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-950">{action.signal_label}</p><p className="mt-1 text-xs font-semibold text-blue-700">{humanize(action.action_type)}</p></div><p className="text-xs text-slate-400">{dateLabel(action.created_at)}</p></div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{action.action_summary}</p>
                {action.growth_opportunity_title ? <p className="mt-2 text-xs text-slate-500">Growth opportunity: {action.growth_opportunity_title}</p> : null}
                {action.action_ref ? <p className="mt-1 text-xs text-slate-500">Reference: {action.action_ref}</p> : null}
              </div>
            ))}</div>
          )}

          {history.length > 0 ? (
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent lifecycle history</p>
              <div className="mt-3 space-y-2">{history.slice(0, 8).map((row) => (
                <div key={row.history_id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"><span><strong>{row.signal_label}</strong> · {humanize(row.from_status)} → {humanize(row.to_status)}</span><span className="text-slate-400">{dateLabel(row.changed_at)}</span></div>
              ))}</div>
            </div>
          ) : null}
        </div>

        <div className="p-5">
          <p className="text-sm font-semibold text-slate-950">Record a concrete action</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Only validated, exploring, or already-acted signals are eligible. This records evidence; it does not itself create a vertical, payment, vendor, or Growth opportunity.</p>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">Demand signal<select value={signalId} onChange={(e) => setSignalId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900"><option value="">Choose signal</option>{actionableSignals.map((signal) => <option key={signal.signalId} value={signal.signalId}>{signal.label} · {humanize(signal.status)}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-600">Action type<select value={actionType} onChange={(e) => setActionType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900">{ACTION_TYPES.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-600">What happened<textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Describe the concrete action and why it responds to the validated need." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="block text-xs font-semibold text-slate-600">Optional reference<input value={actionRef} onChange={(e) => setActionRef(e.target.value)} placeholder="Pilot / partner / internal reference" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <button type="button" onClick={() => void recordAction()} disabled={busy || !signalId || summary.trim().length < 3} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Recording…" : "Record action evidence"}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
