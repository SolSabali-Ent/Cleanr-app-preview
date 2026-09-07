import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Metric = {
  metric_key: string;
  label: string;
  value_numeric: number;
  numerator: number | null;
  denominator: number | null;
  unit: string;
  detail: string;
  sort_order: number;
};

function formatMetric(metric: Metric) {
  if (metric.unit === "percent") return `${metric.value_numeric}%`;
  return Number(metric.value_numeric).toLocaleString();
}

export function AdminRelationshipRecoveryMetrics({ circleId }: { circleId: string | null }) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase.rpc("get_admin_relationship_recovery_metrics", { p_circle_id: circleId }).then(({ data, error: rpcError }) => {
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
        setMetrics([]);
        return;
      }
      setError(null);
      setMetrics((data ?? []) as Metric[]);
    });
    return () => { cancelled = true; };
  }, [circleId]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Relationship recovery</p>
        <h2 className="mt-1 font-semibold text-slate-950">What happens after trust is disrupted?</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">Only purpose-built recovery cases count here. A later booking does not automatically mean repair, and a relationship ending is not automatically a failure.</p>
      </div>
      {error ? <p className="p-5 text-sm text-red-700">{error}</p> : <div className="grid gap-px bg-slate-100 md:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <div key={metric.metric_key} className="bg-white p-5">
        <p className="text-sm font-semibold text-slate-900">{metric.label}</p>
        <p className="mt-3 text-2xl font-bold text-slate-950">{formatMetric(metric)}</p>
        {metric.numerator != null && metric.denominator != null ? <p className="mt-1 text-xs text-slate-500">{metric.numerator} / {metric.denominator}</p> : null}
        <p className="mt-3 text-xs leading-5 text-slate-500">{metric.detail}</p>
      </div>)}</div>}
    </section>
  );
}
