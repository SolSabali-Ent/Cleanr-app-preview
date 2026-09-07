import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";

type SpendSummaryRow = {
  currency: string;
  signals_with_spend_evidence: number;
  spend_observation_count: number;
  total_observed_spend_cents: number;
  first_observed_at: string | null;
  last_observed_at: string | null;
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

export function AdminDemandSpendTransformationEvidence({ circleId }: { circleId: string | null }) {
  const [rows, setRows] = useState<SpendSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_demand_spend_evidence_summary", {
      p_circle_id: circleId,
    });
    if (rpcError) {
      setError(rpcError.message);
      setRows([]);
    } else {
      setRows((data ?? []) as SpendSummaryRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [circleId]);

  const totalObservations = rows.reduce((sum, row) => sum + Number(row.spend_observation_count || 0), 0);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Quantified collective demand</p>
          <h2 className="mt-1 font-semibold text-slate-950">Where repeated need also has observed spend evidence</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            Structured spend observations show money already flowing around a repeated need. This is descriptive evidence only—not market size, household financial profiling, purchasing power, or a reason to automatically launch a vertical.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error ? <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <p className="p-5 text-sm text-slate-500">Loading quantified demand evidence…</p> : rows.length === 0 ? (
        <div className="p-5">
          <p className="text-sm font-semibold text-slate-800">No structured spend evidence yet.</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">This is a measured zero, not a missing truth boundary. Demand can still be valid without spend evidence.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
            <div className="bg-white p-5"><p className="text-xs text-slate-500">Observed transactions</p><p className="mt-1 text-2xl font-bold text-slate-950">{totalObservations.toLocaleString()}</p><p className="mt-2 text-[11px] text-slate-500">Across structured spend-pattern evidence</p></div>
            <div className="bg-white p-5"><p className="text-xs text-slate-500">Currency evidence groups</p><p className="mt-1 text-2xl font-bold text-slate-950">{rows.length}</p><p className="mt-2 text-[11px] text-slate-500">Totals are never combined across currencies</p></div>
          </div>
          <div className="border-t border-slate-200 px-5 py-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <div key={row.currency} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{row.currency}</p><p className="mt-1 text-lg font-bold text-slate-950">{money(row.total_observed_spend_cents, row.currency)}</p></div><p className="text-xs font-semibold text-emerald-700">{row.spend_observation_count} observed</p></div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">{row.signals_with_spend_evidence} demand signal{row.signals_with_spend_evidence === 1 ? "" : "s"} · {dateLabel(row.first_observed_at)} → {dateLabel(row.last_observed_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
