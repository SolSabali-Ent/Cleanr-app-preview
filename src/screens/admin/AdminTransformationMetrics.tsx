import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Circle = {
  circle_id: string;
  name: string;
  locality_label: string | null;
  city: string | null;
  region: string | null;
};

type MetricRow = {
  metric_group: string;
  metric_key: string;
  label: string;
  measurement_status: "measured" | "not_yet_measurable";
  value_numeric: number | null;
  numerator: number | null;
  denominator: number | null;
  unit: string;
  detail: string;
  sort_order: number;
};

const GROUP_LABELS: Record<string, string> = {
  relationship: "Relationship",
  collective: "Collective capacity",
  economic_agency: "Economic agency",
  north_star: "North Star",
  continuum: "Continuum",
  demand: "Collective demand",
};

const GROUP_ORDER = ["relationship", "collective", "economic_agency", "north_star", "continuum", "demand"];

function formatMetric(metric: MetricRow) {
  if (metric.measurement_status !== "measured" || metric.value_numeric == null) return "Not yet measurable";
  if (metric.unit === "percent") return `${metric.value_numeric}%`;
  if (metric.unit === "days") return `${metric.value_numeric} days`;
  return Number(metric.value_numeric).toLocaleString();
}

export function AdminTransformationMetrics() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [scope, setScope] = useState<string>("network");
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadCircles() {
    const { data, error: rpcError } = await supabase.rpc("get_admin_circle_overview");
    if (rpcError) {
      setError(rpcError.message);
      setCircles([]);
      return;
    }
    setCircles((data ?? []) as Circle[]);
  }

  async function loadMetrics(nextScope = scope) {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_transformation_metrics", {
      p_circle_id: nextScope === "network" ? null : nextScope,
    });
    if (rpcError) {
      setError(rpcError.message);
      setMetrics([]);
      setLoading(false);
      return;
    }
    setMetrics((data ?? []) as MetricRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void Promise.all([loadCircles(), loadMetrics("network")]);
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, MetricRow[]>();
    for (const row of metrics) {
      const current = map.get(row.metric_group) ?? [];
      current.push(row);
      map.set(row.metric_group, current);
    }
    return map;
  }, [metrics]);

  const measuredCount = metrics.filter((metric) => metric.measurement_status === "measured").length;
  const gapCount = metrics.filter((metric) => metric.measurement_status === "not_yet_measurable").length;
  const selectedCircle = circles.find((circle) => circle.circle_id === scope) ?? null;

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Transformation metrics</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Is Cleanr increasing collective capacity?</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Evidence from durable product truth across relationships, collective value, economic agency, North Stars, Continuum participation, and repeated demand. There is no synthetic transformation score.
            </p>
          </div>
          <button type="button" onClick={() => void loadMetrics()} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            <RefreshCw size={15} /> Refresh
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,360px)_1fr]">
          <label className="text-xs font-semibold text-slate-600">Scope
            <select
              value={scope}
              onChange={(event) => {
                const next = event.target.value;
                setScope(next);
                void loadMetrics(next);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900"
            >
              <option value="network">Entire Cleanr network</option>
              {circles.map((circle) => <option key={circle.circle_id} value={circle.circle_id}>{circle.name}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <div className="rounded-xl bg-emerald-50 px-4 py-3"><p className="text-xs font-semibold text-emerald-700">Measured now</p><p className="mt-1 text-xl font-bold text-emerald-950">{measuredCount}</p></div>
            <div className="rounded-xl bg-amber-50 px-4 py-3"><p className="text-xs font-semibold text-amber-700">Truth gaps</p><p className="mt-1 text-xl font-bold text-amber-950">{gapCount}</p></div>
          </div>
        </div>
        {selectedCircle ? <p className="mt-3 text-xs text-slate-500">Circle scope: {selectedCircle.locality_label || [selectedCircle.city, selectedCircle.region].filter(Boolean).join(", ") || selectedCircle.name}</p> : <p className="mt-3 text-xs text-slate-500">Network scope includes all durable Cleanr records, whether or not the people are currently assigned to a Circle.</p>}
      </section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading transformation evidence…</section> : GROUP_ORDER.map((group) => {
        const rows = grouped.get(group) ?? [];
        if (rows.length === 0) return null;
        return (
          <section key={group} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-950">{GROUP_LABELS[group] ?? group}</h2>
            </div>
            <div className="grid gap-px bg-slate-100 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((metric) => {
                const measured = metric.measurement_status === "measured";
                return (
                  <div key={metric.metric_key} className="bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{metric.label}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${measured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                        {measured ? "Measured" : "Truth gap"}
                      </span>
                    </div>
                    <p className={`mt-3 font-bold ${measured ? "text-2xl text-slate-950" : "text-sm text-amber-800"}`}>{formatMetric(metric)}</p>
                    {measured && metric.numerator != null && metric.denominator != null ? <p className="mt-1 text-xs text-slate-500">{metric.numerator} / {metric.denominator}</p> : null}
                    <p className="mt-3 text-xs leading-5 text-slate-500">{metric.detail}</p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Measurement discipline</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          A zero means Cleanr can measure the metric and currently has zero qualifying evidence. “Not yet measurable” means the underlying durable product truth does not exist strongly enough to make the claim. Those are intentionally different states.
        </p>
      </section>
    </main>
  );
}
