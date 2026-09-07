import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Metric = {
  metric_key: string;
  label: string;
  value_numeric: number;
  unit: string;
  detail: string;
  sort_order: number;
};

export function AdminPostCleaningContinuum({ circleId }: { circleId: string | null }) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_post_cleaning_continuum", {
      p_circle_id: circleId,
    });
    if (rpcError) {
      setError(rpcError.message);
      setMetrics([]);
    } else {
      setMetrics((data ?? []) as Metric[]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [circleId]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Continuum after cleaning</p>
          <h2 className="mt-1 font-semibold text-slate-950">Does Cleanr remain useful when physical cleaning is no longer the work?</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            This only counts people who explicitly set their service-practice state. Empty availability, old booking history, or marketplace access are never treated as evidence that someone stopped cleaning.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {error ? <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <p className="p-5 text-sm text-slate-500">Loading Continuum evidence…</p> : (
        <div className="grid gap-px bg-slate-100 md:grid-cols-2 xl:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.metric_key} className="bg-white p-5">
              <p className="text-2xl font-bold text-slate-950">{Number(metric.value_numeric).toLocaleString()}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{metric.label}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{metric.unit}</p>
              <p className="mt-3 text-xs leading-5 text-slate-500">{metric.detail}</p>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-200 bg-blue-50/50 px-5 py-4">
        <p className="text-xs leading-5 text-blue-800">
          Moving beyond cleaning is not a graduation requirement. A profitable cleaning practice may remain someone’s North Star; this evidence only becomes relevant when the person says their own practice changed.
        </p>
      </div>
    </section>
  );
}
