import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";

type LifecycleMetrics = {
  active_relationships: number;
  paused_relationships: number;
  ended_relationships: number;
  participant_transitions: number;
  paused_relationships_ever: number;
  resumed_relationships: number;
  resume_rate_percent: number;
};

export function AdminRelationshipLifecycleMetrics({ circleId }: { circleId: string | null }) {
  const [metrics, setMetrics] = useState<LifecycleMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_relationship_lifecycle_metrics", {
      p_circle_id: circleId,
    });
    if (rpcError) {
      setMetrics(null);
      setError(rpcError.message);
      setLoading(false);
      return;
    }
    setMetrics(((data ?? [])[0] ?? null) as LifecycleMetrics | null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [circleId]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Relationship lifecycle</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Can relationships change without losing history?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Participant-owned pause, resume, and end actions are durable relationship truth. These counts describe lifecycle health; they are not a retention score and do not treat ending a relationship as failure.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <p className="mt-4 text-sm text-slate-500">Loading relationship lifecycle evidence…</p> : metrics ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">Active chapters</p><p className="mt-1 text-2xl font-bold text-slate-950">{metrics.active_relationships.toLocaleString()}</p></div>
          <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">Paused chapters</p><p className="mt-1 text-2xl font-bold text-slate-950">{metrics.paused_relationships.toLocaleString()}</p></div>
          <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">Ended chapters</p><p className="mt-1 text-2xl font-bold text-slate-950">{metrics.ended_relationships.toLocaleString()}</p></div>
          <div className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-semibold text-slate-500">Participant-owned changes</p><p className="mt-1 text-2xl font-bold text-slate-950">{metrics.participant_transitions.toLocaleString()}</p></div>
          <div className="rounded-xl border border-slate-200 p-4 sm:col-span-2 xl:col-span-2">
            <p className="text-xs font-semibold text-slate-500">Paused relationships deliberately resumed</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{metrics.resumed_relationships.toLocaleString()} / {metrics.paused_relationships_ever.toLocaleString()}</p>
            <p className="mt-1 text-xs text-slate-500">{metrics.resume_rate_percent}% of relationships that have ever been paused were later resumed by a participant.</p>
          </div>
        </div>
      ) : <p className="mt-4 text-sm text-slate-500">No lifecycle evidence available.</p>}
    </section>
  );
}
