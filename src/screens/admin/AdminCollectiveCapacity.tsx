import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Network, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabase";

const OPPORTUNITY_TYPES = [
  "backup_coverage",
  "referral",
  "mentorship",
  "training",
  "leadership",
  "business",
  "vendor",
  "education",
  "external",
  "investment",
] as const;

type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];
type Filter = "all" | "available" | "circulated";

type CapacityRow = {
  contribution_id: string;
  person_id: string;
  contributor_name: string | null;
  contributor_role: string | null;
  contribution_type: string;
  source_type: string | null;
  source_system: string;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
  can_circulate: boolean;
  available_to_circulate: boolean;
  circulated: boolean;
  opportunity_count: number;
  opportunity_ids: string[] | null;
  opportunity_titles: string[] | null;
  last_circulated_at: string | null;
};

type Draft = {
  opportunityType: OpportunityType;
  title: string;
  description: string;
  capacityReason: string;
  visibility: "matched_only" | "network";
  geographicScope: string;
};

const EMPTY_DRAFT: Draft = {
  opportunityType: "referral",
  title: "",
  description: "",
  capacityReason: "",
  visibility: "matched_only",
  geographicScope: "",
};

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function date(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AdminCollectiveCapacity() {
  const [rows, setRows] = useState<CapacityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_collective_capacity");
    if (rpcError) {
      setRows([]);
      setError(rpcError.message);
    } else {
      setRows((data ?? []) as CapacityRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => ({
    created: rows.length,
    available: rows.filter((row) => row.available_to_circulate).length,
    circulated: rows.filter((row) => row.circulated).length,
  }), [rows]);

  const visibleRows = useMemo(() => {
    if (filter === "available") return rows.filter((row) => row.available_to_circulate);
    if (filter === "circulated") return rows.filter((row) => row.circulated);
    return rows;
  }, [filter, rows]);

  const selected = rows.find((row) => row.contribution_id === selectedId) ?? null;

  function openCreate(row: CapacityRow) {
    setSelectedId(row.contribution_id);
    setSuccess(null);
    setError(null);
    setDraft({
      ...EMPTY_DRAFT,
      opportunityType: row.contribution_type === "mentorship" ? "mentorship" : row.contribution_type === "leadership" ? "leadership" : row.contribution_type === "backup_coverage" || row.contribution_type === "trust_handoff" ? "backup_coverage" : "referral",
      capacityReason: `Verified ${label(row.contribution_type).toLowerCase()} created reusable capacity for the Cleanr network.`,
    });
  }

  async function createOpportunity() {
    if (!selected) return;
    if (draft.title.trim().length < 2 || draft.capacityReason.trim().length < 3) {
      setError("Add an opportunity title and explain what collective capacity made it possible.");
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);
    const { data, error: rpcError } = await supabase.rpc("create_growth_opportunity_from_contribution", {
      p_contribution_id: selected.contribution_id,
      p_source_system: "admin",
      p_capacity_reason: draft.capacityReason.trim(),
      p_opportunity_type: draft.opportunityType,
      p_title: draft.title.trim(),
      p_description: draft.description.trim() || null,
      p_visibility: draft.visibility,
      p_geographic_scope: draft.geographicScope.trim() || null,
      p_starts_at: null,
      p_closes_at: null,
    });
    setCreating(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const opportunity = data as { id?: string; title?: string } | null;
    setSuccess(`Created ${opportunity?.title ?? draft.title.trim()} from verified collective capacity.`);
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    await load();
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Collective capacity</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Value that can become new opportunity</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Verified contributions are durable Cleanr product truth. Admin can turn eligible capacity into a non-service Growth opportunity while Kinex remains responsible for orchestration, matching, communication, and next-best-action logic.
            </p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <button type="button" onClick={() => setFilter("all")} className={`rounded-xl border p-4 text-left ${filter === "all" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            <p className="text-2xl font-bold text-slate-950">{counts.created}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">Created</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Verified assets recorded in the contribution ledger.</p>
          </button>
          <button type="button" onClick={() => setFilter("available")} className={`rounded-xl border p-4 text-left ${filter === "available" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            <p className="text-2xl font-bold text-slate-950">{counts.available}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">Available to circulate</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Eligible value not yet linked to a Growth opportunity.</p>
          </button>
          <button type="button" onClick={() => setFilter("circulated")} className={`rounded-xl border p-4 text-left ${filter === "circulated" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
            <p className="text-2xl font-bold text-slate-950">{counts.circulated}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">Circulated</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Contribution value already used to create new network capacity.</p>
          </button>
        </div>
      </section>

      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {selected ? (
        <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-700"><Sparkles size={16} /><p className="text-xs font-semibold uppercase tracking-wide">Create from verified capacity</p></div>
              <h2 className="mt-2 text-lg font-bold text-slate-950">{label(selected.contribution_type)} · {selected.contributor_name || "Cleanr member"}</h2>
              <p className="mt-1 text-sm text-slate-500">Recorded {date(selected.occurred_at)} · {selected.source_system}</p>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="text-sm font-semibold text-slate-500">Close</button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Opportunity type
              <select value={draft.opportunityType} onChange={(e) => setDraft((current) => ({ ...current, opportunityType: e.target.value as OpportunityType }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900">
                {OPPORTUNITY_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">Visibility
              <select value={draft.visibility} onChange={(e) => setDraft((current) => ({ ...current, visibility: e.target.value as Draft["visibility"] }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900">
                <option value="matched_only">Matched only</option>
                <option value="network">Network</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 md:col-span-2">Opportunity title
              <input value={draft.title} onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))} placeholder="Example: Mentor a new CSP through first recurring client" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" />
            </label>
            <label className="text-xs font-semibold text-slate-600 md:col-span-2">Why this contribution created capacity
              <textarea value={draft.capacityReason} onChange={(e) => setDraft((current) => ({ ...current, capacityReason: e.target.value }))} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" />
            </label>
            <label className="text-xs font-semibold text-slate-600 md:col-span-2">Description <span className="font-normal text-slate-400">optional</span>
              <textarea value={draft.description} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" />
            </label>
            <label className="text-xs font-semibold text-slate-600 md:col-span-2">Geographic scope <span className="font-normal text-slate-400">optional</span>
              <input value={draft.geographicScope} onChange={(e) => setDraft((current) => ({ ...current, geographicScope: e.target.value }))} placeholder="Example: Atlanta metro" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" />
            </label>
          </div>

          <div className="mt-5 flex justify-end">
            <button type="button" onClick={() => void createOpportunity()} disabled={creating} className="flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {creating ? "Creating…" : "Create opportunity from this value"} <ArrowRight size={15} />
            </button>
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Contribution capacity ledger</h2>
          <p className="mt-1 text-xs text-slate-500">{filter === "all" ? "All verified contribution assets" : filter === "available" ? "Eligible contribution assets not yet circulated" : "Contribution assets already linked to opportunity creation"}</p>
        </div>

        {loading ? <p className="p-5 text-sm text-slate-500">Loading collective capacity…</p> : visibleRows.length === 0 ? (
          <div className="p-8 text-center"><Network className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">No contributions in this state yet.</p></div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleRows.map((row) => (
              <article key={row.contribution_id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-950">{label(row.contribution_type)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.circulated ? "bg-blue-50 text-blue-700" : row.available_to_circulate ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {row.circulated ? "Circulated" : row.available_to_circulate ? "Available" : "Recorded"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{row.contributor_name || "Cleanr member"} · {row.contributor_role || "member"}</p>
                    <p className="mt-1 text-xs text-slate-500">{row.source_type ? label(row.source_type) : label(row.source_system)} · {date(row.occurred_at)}</p>
                    {row.circulated && (row.opportunity_titles?.length ?? 0) > 0 ? (
                      <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2.5">
                        <p className="text-xs font-semibold text-blue-800">This value circulated</p>
                        <p className="mt-1 text-xs text-blue-700">{row.opportunity_titles?.join(" · ")}</p>
                      </div>
                    ) : null}
                  </div>

                  {row.available_to_circulate ? (
                    <button type="button" onClick={() => openCreate(row)} className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                      Create opportunity
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
