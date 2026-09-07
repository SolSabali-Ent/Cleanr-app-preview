import { useEffect, useMemo, useState } from "react";
import { DollarSign, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";

type SpendRow = {
  signal_id: string;
  signal_label: string;
  signal_status: string;
  currency: string;
  spend_observation_count: number;
  total_observed_spend_cents: number;
  first_observed_at: string | null;
  last_observed_at: string | null;
};

type SignalOption = {
  signalId: string;
  label: string;
  status: string;
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(cents || 0) / 100);
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AdminDemandSpendEvidence({
  circleId,
  signals,
  onRecorded,
}: {
  circleId: string;
  signals: SignalOption[];
  onRecorded: () => Promise<void>;
}) {
  const [rows, setRows] = useState<SpendRow[]>([]);
  const [signalId, setSignalId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [sourceRef, setSourceRef] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activeSignals = useMemo(() => signals.filter((signal) => signal.status !== "retired"), [signals]);

  async function load() {
    if (!circleId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("get_admin_circle_demand_spend_evidence", {
      p_circle_id: circleId,
    });
    if (rpcError) {
      setError(rpcError.message);
      setRows([]);
    } else {
      setRows((data ?? []) as SpendRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    setSignalId((current) => current && activeSignals.some((signal) => signal.signalId === current) ? current : (activeSignals[0]?.signalId ?? ""));
  }, [circleId, activeSignals]);

  useEffect(() => { void load(); }, [circleId]);

  async function record() {
    const numeric = Number(amount);
    if (!signalId || !Number.isFinite(numeric) || numeric <= 0 || note.trim().length < 3 || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    const { error: rpcError } = await supabase.rpc("admin_add_circle_demand_spend_observation", {
      p_signal_id: signalId,
      p_amount_cents: Math.round(numeric * 100),
      p_currency: currency.trim().toUpperCase() || "USD",
      p_source_ref: sourceRef.trim() || null,
      p_observation_note: note.trim(),
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setAmount("");
    setSourceRef("");
    setNote("");
    setSuccess("Structured spend evidence recorded. No payment or commerce action was created.");
    await Promise.all([load(), onRecorded()]);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Observed spend evidence</p>
          <h2 className="mt-1 font-semibold text-slate-950">What this Circle is already spending money on</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            Structured transaction observations can strengthen demand evidence before Cleanr considers a future vertical. These records do not charge anyone, create a vendor, infer household finances, or automatically create an opportunity.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error ? <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="mx-5 mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="border-b border-slate-200 xl:border-b-0 xl:border-r">
          {loading ? <p className="p-5 text-sm text-slate-500">Loading spend evidence…</p> : rows.length === 0 ? (
            <div className="p-6 text-center"><DollarSign className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">No structured spend evidence yet.</p><p className="mt-1 text-xs text-slate-500">Need observations can exist without spend. Record money only when there is a real observed transaction amount.</p></div>
          ) : (
            <div className="divide-y divide-slate-100">{rows.map((row) => (
              <div key={`${row.signal_id}:${row.currency}`} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-sm font-semibold text-slate-950">{row.signal_label}</p><p className="mt-1 text-xs text-slate-500">{row.spend_observation_count} observed transaction{row.spend_observation_count === 1 ? "" : "s"} · {row.signal_status}</p></div>
                  <p className="text-lg font-bold text-slate-950">{money(row.total_observed_spend_cents, row.currency)}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500">Observed from {dateLabel(row.first_observed_at)} through {dateLabel(row.last_observed_at)} · {row.currency}</p>
              </div>
            ))}</div>
          )}
        </div>

        <div className="p-5">
          <p className="text-sm font-semibold text-slate-950">Add observed transaction evidence</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Use only a real observed amount. Do not put names, card details, bank information, or unnecessary personal context in the note/reference.</p>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">Demand signal<select value={signalId} onChange={(e) => setSignalId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900"><option value="">Choose signal</option>{activeSignals.map((signal) => <option key={signal.signalId} value={signal.signalId}>{signal.label}</option>)}</select></label>
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <label className="text-xs font-semibold text-slate-600">Observed amount<input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="125.00" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
              <label className="text-xs font-semibold text-slate-600">Currency<input value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            </div>
            <label className="block text-xs font-semibold text-slate-600">Optional source reference<input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="Invoice / internal reference" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="block text-xs font-semibold text-slate-600">Why this amount is relevant<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe the observed transaction without unnecessary personal detail." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <button type="button" onClick={() => void record()} disabled={busy || !signalId || !(Number(amount) > 0) || note.trim().length < 3} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Recording…" : "Record spend evidence"}</button>
          </div>
        </div>
      </div>
    </section>
  );
}
