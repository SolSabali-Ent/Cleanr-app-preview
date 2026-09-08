import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { AdminEconomicAgencyActivity } from "./AdminEconomicAgencyActivity";
import { AdminFeePolicyEconomics } from "./AdminFeePolicyEconomics";
import { AdminCollectiveCircularity } from "./AdminCollectiveCircularity";
import { AdminPostCleaningContinuum } from "./AdminPostCleaningContinuum";
import { AdminRelationshipRecoveryMetrics } from "./AdminRelationshipRecoveryMetrics";
import { AdminHouseholdMemoryAssets } from "./AdminHouseholdMemoryAssets";
import { AdminRelationshipLifecycleMetrics } from "./AdminRelationshipLifecycleMetrics";
import { AdminDemandSpendTransformationEvidence } from "./AdminDemandSpendTransformationEvidence";
import { AdminTrustedHandoffFulfillmentMetrics } from "./AdminTrustedHandoffFulfillmentMetrics";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminSecondaryButton,
  AdminStatus,
  AdminTableShell,
  AdminTabs,
} from "./AdminUi";

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

type MetricView = "relationship" | "collective" | "economic_agency" | "north_star" | "continuum" | "demand" | "evidence";

const GROUP_LABELS: Record<Exclude<MetricView, "evidence">, string> = {
  relationship: "Relationships",
  collective: "Collective capacity",
  economic_agency: "Economic agency",
  north_star: "North Star",
  continuum: "Continuum",
  demand: "Demand",
};

function formatMetric(metric: MetricRow) {
  if (metric.measurement_status !== "measured" || metric.value_numeric == null) return "Not measurable yet";
  if (metric.unit === "percent") return `${metric.value_numeric}%`;
  if (metric.unit === "days") return `${metric.value_numeric} days`;
  return Number(metric.value_numeric).toLocaleString();
}

export function AdminTransformationMetrics() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [scope, setScope] = useState<string>("network");
  const [view, setView] = useState<MetricView>("relationship");
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

  useEffect(() => { void Promise.all([loadCircles(), loadMetrics("network")]); }, []);

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
  const scopedCircleId = scope === "network" ? null : scope;
  const currentRows = view === "evidence" ? [] : grouped.get(view) ?? [];

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        eyebrow="Network intelligence"
        title="Transformation metrics"
        description="Evidence that shows whether Cleanr is increasing relationship strength, agency, and collective capacity."
        meta={<span className="text-xs text-slate-500">{measuredCount} measured · {gapCount} truth gap{gapCount === 1 ? "" : "s"}</span>}
        actions={
          <>
            <label className="text-xs font-semibold text-slate-500">
              Scope
              <select
                value={scope}
                onChange={(event) => {
                  const next = event.target.value;
                  setScope(next);
                  void loadMetrics(next);
                }}
                className="ml-2 min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900"
              >
                <option value="network">Entire network</option>
                {circles.map((circle) => <option key={circle.circle_id} value={circle.circle_id}>{circle.name}</option>)}
              </select>
            </label>
            <AdminSecondaryButton onClick={() => void loadMetrics()}><RefreshCw className="h-4 w-4" /> Refresh</AdminSecondaryButton>
          </>
        }
      />

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      <AdminTabs
        value={view}
        onChange={setView}
        items={[
          { value: "relationship", label: "Relationships", count: (grouped.get("relationship") ?? []).length },
          { value: "collective", label: "Collective", count: (grouped.get("collective") ?? []).length },
          { value: "economic_agency", label: "Agency", count: (grouped.get("economic_agency") ?? []).length },
          { value: "north_star", label: "North Star", count: (grouped.get("north_star") ?? []).length },
          { value: "continuum", label: "Continuum", count: (grouped.get("continuum") ?? []).length },
          { value: "demand", label: "Demand", count: (grouped.get("demand") ?? []).length },
          { value: "evidence", label: "Deep dives" },
        ]}
      />

      {view !== "evidence" ? (
        loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading metrics…</div>
        ) : currentRows.length === 0 ? (
          <AdminEmptyState title={`No ${GROUP_LABELS[view]} metrics in this scope`} />
        ) : (
          <AdminTableShell>
            <div className="grid grid-cols-[minmax(260px,1.1fr)_180px_150px_minmax(320px,1.5fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Metric</span><span>Value</span><span>Status</span><span>What it means</span>
            </div>
            {currentRows.map((metric) => {
              const measured = metric.measurement_status === "measured";
              return (
                <div key={metric.metric_key} className="grid grid-cols-[minmax(260px,1.1fr)_180px_150px_minmax(320px,1.5fr)] items-start gap-4 border-b border-slate-200 px-5 py-4 last:border-b-0">
                  <p className="text-sm font-semibold text-slate-950">{metric.label}</p>
                  <div>
                    <p className={`font-semibold ${measured ? "text-xl text-slate-950" : "text-sm text-amber-700"}`}>{formatMetric(metric)}</p>
                    {measured && metric.numerator != null && metric.denominator != null ? <p className="mt-1 text-[11px] text-slate-500">{metric.numerator} / {metric.denominator}</p> : null}
                  </div>
                  <AdminStatus tone={measured ? "success" : "warning"}>{measured ? "Measured" : "Truth gap"}</AdminStatus>
                  <p className="text-xs leading-5 text-slate-600">{metric.detail}</p>
                </div>
              );
            })}
          </AdminTableShell>
        )
      ) : (
        <div className="space-y-3">
          {[
            ["Household memory", <AdminHouseholdMemoryAssets key="memory" circleId={scopedCircleId} />],
            ["Relationship lifecycle", <AdminRelationshipLifecycleMetrics key="lifecycle" circleId={scopedCircleId} />],
            ["Trusted handoffs", <AdminTrustedHandoffFulfillmentMetrics key="handoffs" circleId={scopedCircleId} />],
            ["Relationship recovery", <AdminRelationshipRecoveryMetrics key="recovery" circleId={scopedCircleId} />],
            ["Economic agency", <AdminEconomicAgencyActivity key="agency" circleId={scopedCircleId} />],
            ["Fee policy economics", <AdminFeePolicyEconomics key="fees" circleId={scopedCircleId} />],
            ["Demand and spend evidence", <AdminDemandSpendTransformationEvidence key="demand" circleId={scopedCircleId} />],
            ["Collective circularity", <AdminCollectiveCircularity key="circularity" circleId={scopedCircleId} />],
            ["Post-cleaning Continuum", <AdminPostCleaningContinuum key="continuum" circleId={scopedCircleId} />],
          ].map(([label, content]) => (
            <details key={String(label)} className="rounded-2xl border border-slate-200 bg-white">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">{label}</summary>
              <div className="border-t border-slate-200 p-4">{content}</div>
            </details>
          ))}
        </div>
      )}

      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">Measurement rules</summary>
        <p className="border-t border-slate-200 px-5 py-4 text-xs leading-5 text-slate-600">
          Zero means Cleanr can measure the metric and currently has zero qualifying evidence. “Not measurable yet” means the underlying durable product truth is not strong enough to make the claim. Cleanr does not create a synthetic transformation score.
        </p>
      </details>
    </AdminPage>
  );
}
