import { useEffect, useMemo, useState } from "react";
import { ArrowRight, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminStatus,
  AdminTableShell,
  AdminTabs,
} from "./AdminUi";

const OPPORTUNITY_TYPES = ["backup_coverage","referral","mentorship","training","leadership","business","vendor","education","external","investment"] as const;
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

type Draft = { opportunityType: OpportunityType; title: string; description: string; capacityReason: string; visibility: "matched_only" | "network"; geographicScope: string };
const EMPTY_DRAFT: Draft = { opportunityType: "referral", title: "", description: "", capacityReason: "", visibility: "matched_only", geographicScope: "" };

function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function date(value: string | null) { if (!value) return "—"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }

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
    setLoading(true); setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_collective_capacity");
    if (rpcError) { setRows([]); setError(rpcError.message); }
    else setRows((data ?? []) as CapacityRow[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => ({ created: rows.length, available: rows.filter((row) => row.available_to_circulate).length, circulated: rows.filter((row) => row.circulated).length }), [rows]);
  const visibleRows = useMemo(() => filter === "available" ? rows.filter((row) => row.available_to_circulate) : filter === "circulated" ? rows.filter((row) => row.circulated) : rows, [filter, rows]);
  const selected = rows.find((row) => row.contribution_id === selectedId) ?? null;

  function openCreate(row: CapacityRow) {
    setSelectedId(row.contribution_id); setSuccess(null); setError(null);
    setDraft({ ...EMPTY_DRAFT, opportunityType: row.contribution_type === "mentorship" ? "mentorship" : row.contribution_type === "leadership" ? "leadership" : row.contribution_type === "backup_coverage" || row.contribution_type === "trust_handoff" ? "backup_coverage" : "referral", capacityReason: `Verified ${label(row.contribution_type).toLowerCase()} created reusable capacity for the Cleanr network.` });
  }

  async function createOpportunity() {
    if (!selected) return;
    if (draft.title.trim().length < 2 || draft.capacityReason.trim().length < 3) return setError("Add an opportunity title and explain what collective capacity made it possible.");
    setCreating(true); setError(null); setSuccess(null);
    const { data, error: rpcError } = await supabase.rpc("create_growth_opportunity_from_contribution", {
      p_contribution_id: selected.contribution_id, p_source_system: "admin", p_capacity_reason: draft.capacityReason.trim(), p_opportunity_type: draft.opportunityType,
      p_title: draft.title.trim(), p_description: draft.description.trim() || null, p_visibility: draft.visibility, p_geographic_scope: draft.geographicScope.trim() || null, p_starts_at: null, p_closes_at: null,
    });
    setCreating(false);
    if (rpcError) return setError(rpcError.message);
    const opportunity = data as { id?: string; title?: string } | null;
    setSuccess(`Created ${opportunity?.title ?? draft.title.trim()} from verified collective capacity.`); setSelectedId(null); setDraft(EMPTY_DRAFT); await load();
  }

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        eyebrow="Network intelligence"
        title="Collective capacity"
        description="Verified value that can be reused to create new opportunity. Cleanr records the capacity; Kinex remains the orchestration layer."
        actions={<AdminSecondaryButton disabled={loading} onClick={() => void load()}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</AdminSecondaryButton>}
      />

      {success ? <AdminNotice tone="success">{success}</AdminNotice> : null}
      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      <AdminTabs value={filter} onChange={setFilter} items={[{ value: "all", label: "All capacity", count: counts.created }, { value: "available", label: "Available", count: counts.available }, { value: "circulated", label: "Circulated", count: counts.circulated }]} />

      <AdminTableShell>
        <div className="grid grid-cols-[minmax(250px,1.2fr)_190px_150px_minmax(260px,1.2fr)_170px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span>Contributor</span><span>Capacity</span><span>Status</span><span>What it created</span><span className="text-right">Action</span>
        </div>
        {loading ? <p className="px-5 py-5 text-sm text-slate-500">Loading collective capacity…</p> : visibleRows.length === 0 ? <div className="p-5"><AdminEmptyState title="No capacity in this state yet" /></div> : visibleRows.map((row) => (
          <div key={row.contribution_id} className="grid grid-cols-[minmax(250px,1.2fr)_190px_150px_minmax(260px,1.2fr)_170px] items-center gap-4 border-b border-slate-200 px-5 py-4 last:border-b-0">
            <div><p className="text-sm font-semibold text-slate-950">{row.contributor_name || "Cleanr member"}</p><p className="mt-1 text-xs text-slate-500">{row.contributor_role || "member"} · {date(row.occurred_at)}</p></div>
            <div><p className="text-sm font-medium text-slate-900">{label(row.contribution_type)}</p><p className="mt-1 text-[11px] text-slate-500">{row.source_type ? label(row.source_type) : label(row.source_system)}</p></div>
            <AdminStatus tone={row.circulated ? "info" : row.available_to_circulate ? "success" : "neutral"}>{row.circulated ? "Circulated" : row.available_to_circulate ? "Available" : "Recorded"}</AdminStatus>
            <p className="text-xs leading-5 text-slate-600">{row.opportunity_titles?.length ? row.opportunity_titles.join(" · ") : "Not yet converted into another opportunity"}</p>
            <div className="text-right">{row.available_to_circulate ? <AdminPrimaryButton onClick={() => openCreate(row)}>Create opportunity</AdminPrimaryButton> : null}</div>
          </div>
        ))}
      </AdminTableShell>

      {selected ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Create from verified capacity</p><h2 className="mt-1 text-lg font-semibold text-slate-950">{label(selected.contribution_type)} · {selected.contributor_name || "Cleanr member"}</h2></div><button type="button" onClick={() => setSelectedId(null)} className="text-xs font-semibold text-slate-500">Close</button></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">Opportunity type<select value={draft.opportunityType} onChange={(e) => setDraft((current) => ({ ...current, opportunityType: e.target.value as OpportunityType }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900">{OPPORTUNITY_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-500">Visibility<select value={draft.visibility} onChange={(e) => setDraft((current) => ({ ...current, visibility: e.target.value as Draft["visibility"] }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900"><option value="matched_only">Matched only</option><option value="network">Network</option></select></label>
            <label className="text-xs font-semibold text-slate-500 md:col-span-2">Title<input value={draft.title} onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500 md:col-span-2">Capacity reason<textarea value={draft.capacityReason} onChange={(e) => setDraft((current) => ({ ...current, capacityReason: e.target.value }))} rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500 md:col-span-2">Description<textarea value={draft.description} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500 md:col-span-2">Geographic scope<input value={draft.geographicScope} onChange={(e) => setDraft((current) => ({ ...current, geographicScope: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
          </div>
          <div className="mt-4 flex justify-end"><AdminPrimaryButton disabled={creating} onClick={() => void createOpportunity()}>{creating ? "Creating…" : "Create opportunity"} <ArrowRight className="h-4 w-4" /></AdminPrimaryButton></div>
        </div>
      ) : null}

      <details className="rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">Capacity boundary</summary><p className="border-t border-slate-200 px-5 py-4 text-xs leading-5 text-slate-600">Creating an opportunity records durable Cleanr product truth. It does not match people, send communication, or choose a next-best action; those remain Kinex responsibilities.</p></details>
    </AdminPage>
  );
}
