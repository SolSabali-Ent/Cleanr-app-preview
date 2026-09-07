import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Metric = {
  metric_key: string;
  label: string;
  value_numeric: number;
  unit: string;
  detail: string;
  sort_order: number;
};

export function AdminHouseholdMemoryAssets({ circleId }: { circleId: string | null }) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void supabase.rpc("get_admin_household_memory_asset_summary", { p_circle_id: circleId }).then(({ data, error: rpcError }) => {
      if (!active) return;
      if (rpcError) {
        setError(rpcError.message);
        setMetrics([]);
      } else {
        setMetrics((data ?? []) as Metric[]);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [circleId]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Relationship memory asset</p>
          <h2 className="mt-1 font-semibold text-slate-950">What Cleanr remembers only with customer consent</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            This panel measures consent and reusable-memory adoption only. It never exposes household preference text, CSP suggestion text, booking access details, or customer identities.
          </p>
        </div>
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
      </div>

      {loading ? (
        <p className="p-5 text-sm text-slate-500">Loading memory-asset evidence…</p>
      ) : error ? (
        <p className="p-5 text-sm text-red-700">{error}</p>
      ) : (
        <div className="grid gap-px bg-slate-100 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.metric_key} className="bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">{metric.label}</p>
              <p className="mt-3 text-2xl font-bold text-slate-950">{Number(metric.value_numeric ?? 0).toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">{metric.unit}</p>
              <p className="mt-3 text-xs leading-5 text-slate-500">{metric.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-5 text-slate-600">
        Reusable memory is a relationship asset only when the household controls it. Declining a suggestion or turning memory off is a valid outcome, not a failure state.
      </div>
    </section>
  );
}
