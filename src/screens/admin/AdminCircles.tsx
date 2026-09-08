import { useEffect, useMemo, useState } from "react";
import { CircleDot, Plus, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { AdminCircleLifecycle } from "./AdminCircleLifecycle";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminStatStrip,
  AdminStatus,
  AdminTableShell,
  AdminTabs,
} from "./AdminUi";

type CircleRow = {
  circle_id: string;
  slug: string;
  name: string;
  status: string;
  locality_label: string | null;
  city: string | null;
  region: string | null;
  country: string;
  member_count: number;
  csp_count: number;
  household_count: number;
  active_service_relationships: number;
  repeat_service_relationships: number;
  active_coverage_partnerships: number;
  contribution_count: number;
  opportunity_count: number;
  circulated_contribution_count: number;
  created_at: string;
};

type PersonRow = {
  person_id: string;
  full_name: string | null;
  profile_role: string;
  zip_code: string | null;
  is_member: boolean;
  membership_status: string | null;
  participation_role: string | null;
  joined_at: string | null;
};

type RelationshipEdge = {
  connection_type: string;
  connection_id: string;
  source_person_id: string;
  source_name: string | null;
  source_profile_role: string;
  target_person_id: string;
  target_name: string | null;
  target_profile_role: string;
  relationship_kind: string;
  relationship_status: string;
  relationship_origin: string;
  evidence_count: number | null;
  started_at: string | null;
  last_activity_at: string | null;
};

type ValueFlowRow = {
  contribution_id: string;
  contributor_person_id: string;
  contributor_name: string | null;
  contributor_profile_role: string;
  contribution_type: string;
  contribution_source_type: string | null;
  contribution_occurred_at: string;
  circulation_status: string;
  capacity_reason: string | null;
  opportunity_id: string | null;
  opportunity_title: string | null;
  opportunity_type: string | null;
  opportunity_status: string | null;
  opportunity_created_at: string | null;
};

type ContinuumCapacityRow = { participation_key: string; active_count: number; evidenced_count: number; self_declared_count: number };
type MemberContinuumRow = { person_id: string; full_name: string | null; profile_role: string; participation_role: string; participation_key: string | null; evidence_status: string | null; participation_origin: string | null; provenance_type: string | null; started_at: string | null };
type CircleView = "overview" | "members" | "relationships" | "value" | "continuum" | "lifecycle";

type Draft = { name: string; slug: string; localityLabel: string; city: string; region: string; country: string; description: string };

const EMPTY_DRAFT: Draft = { name: "", slug: "", localityLabel: "", city: "Atlanta", region: "GA", country: "US", description: "" };
const CONTINUUM_LABELS: Record<string, string> = {
  service_provider: "Residential service provider",
  coverage_partner: "Trusted coverage partner",
  collaborator: "Collaborator",
  mentor: "Mentor",
  business_owner: "Business owner",
  vendor: "Vendor",
  employer: "Employer",
  investor: "Investor",
  advisor: "Advisor",
  opportunity_creator: "Opportunity creator",
};

function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function continuumLabel(value: string | null | undefined) { return value ? CONTINUUM_LABELS[value] ?? humanize(value) : "—"; }
function dateLabel(value: string | null | undefined) { return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"; }

export function AdminCircles() {
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [relationships, setRelationships] = useState<RelationshipEdge[]>([]);
  const [valueFlow, setValueFlow] = useState<ValueFlowRow[]>([]);
  const [continuumCapacity, setContinuumCapacity] = useState<ContinuumCapacityRow[]>([]);
  const [memberContinuum, setMemberContinuum] = useState<MemberContinuumRow[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [view, setView] = useState<CircleView>("overview");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyPersonId, setBusyPersonId] = useState<string | null>(null);

  async function loadCircles(preferredId?: string | null) {
    setLoading(true); setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_circle_overview");
    if (rpcError) { setError(rpcError.message); setCircles([]); setLoading(false); return; }
    const rows = (data ?? []) as CircleRow[];
    setCircles(rows);
    const next = preferredId && rows.some((row) => row.circle_id === preferredId) ? preferredId : selectedCircleId && rows.some((row) => row.circle_id === selectedCircleId) ? selectedCircleId : rows[0]?.circle_id ?? null;
    setSelectedCircleId(next); setLoading(false);
  }

  async function loadCircleDetail(circleId: string) {
    setDetailLoading(true);
    const [peopleResult, relationshipsResult, valueFlowResult, continuumResult, memberContinuumResult] = await Promise.all([
      supabase.rpc("get_admin_circle_people", { p_circle_id: circleId }),
      supabase.rpc("get_admin_circle_relationship_edges", { p_circle_id: circleId }),
      supabase.rpc("get_admin_circle_value_flow", { p_circle_id: circleId }),
      supabase.rpc("get_admin_circle_continuum_capacity", { p_circle_id: circleId }),
      supabase.rpc("get_admin_circle_member_continuum", { p_circle_id: circleId }),
    ]);
    const firstError = peopleResult.error ?? relationshipsResult.error ?? valueFlowResult.error ?? continuumResult.error ?? memberContinuumResult.error;
    if (firstError) setError(firstError.message);
    setPeople(peopleResult.error ? [] : (peopleResult.data ?? []) as PersonRow[]);
    setRelationships(relationshipsResult.error ? [] : (relationshipsResult.data ?? []) as RelationshipEdge[]);
    setValueFlow(valueFlowResult.error ? [] : (valueFlowResult.data ?? []) as ValueFlowRow[]);
    setContinuumCapacity(continuumResult.error ? [] : (continuumResult.data ?? []) as ContinuumCapacityRow[]);
    setMemberContinuum(memberContinuumResult.error ? [] : (memberContinuumResult.data ?? []) as MemberContinuumRow[]);
    setDetailLoading(false);
  }

  useEffect(() => { void loadCircles(); }, []);
  useEffect(() => {
    if (selectedCircleId) void loadCircleDetail(selectedCircleId);
    else { setPeople([]); setRelationships([]); setValueFlow([]); setContinuumCapacity([]); setMemberContinuum([]); }
  }, [selectedCircleId]);

  const selected = useMemo(() => circles.find((row) => row.circle_id === selectedCircleId) ?? null, [circles, selectedCircleId]);
  const activeMembers = useMemo(() => people.filter((row) => row.membership_status === "active"), [people]);
  const availablePeople = useMemo(() => people.filter((row) => row.membership_status !== "active"), [people]);
  const serviceEdges = useMemo(() => relationships.filter((row) => row.connection_type === "service_relationship"), [relationships]);
  const networkEdges = useMemo(() => relationships.filter((row) => row.connection_type === "network_relationship"), [relationships]);
  const participationByPerson = useMemo(() => {
    const grouped = new Map<string, MemberContinuumRow[]>();
    for (const row of memberContinuum) {
      if (!row.participation_key) continue;
      const current = grouped.get(row.person_id) ?? [];
      current.push(row); grouped.set(row.person_id, current);
    }
    return grouped;
  }, [memberContinuum]);

  async function createCircle() {
    if (draft.name.trim().length < 2 || !draft.slug.trim()) return setError("Add a Circle name and slug.");
    setCreating(true); setError(null); setSuccess(null);
    const { data, error: rpcError } = await supabase.rpc("admin_create_cleanr_circle", {
      p_name: draft.name.trim(), p_slug: draft.slug.trim().toLowerCase(), p_locality_label: draft.localityLabel.trim() || null,
      p_city: draft.city.trim() || null, p_region: draft.region.trim() || null, p_country: draft.country.trim() || "US", p_description: draft.description.trim() || null,
    });
    setCreating(false);
    if (rpcError) return setError(rpcError.message);
    const row = data as { id?: string; name?: string } | null;
    setSuccess(`Created ${row?.name ?? draft.name.trim()} as a forming Cleanr Circle.`); setDraft(EMPTY_DRAFT); setShowCreate(false); await loadCircles(row?.id ?? null);
  }

  async function setMember(person: PersonRow, active: boolean) {
    if (!selectedCircleId || busyPersonId) return;
    setBusyPersonId(person.person_id); setError(null);
    const { error: rpcError } = await supabase.rpc("admin_set_circle_member", {
      p_circle_id: selectedCircleId, p_person_id: person.person_id, p_participation_role: person.participation_role ?? "member", p_status: active ? "active" : "ended", p_provenance_type: "admin",
    });
    setBusyPersonId(null);
    if (rpcError) return setError(rpcError.message);
    await Promise.all([loadCircleDetail(selectedCircleId), loadCircles(selectedCircleId)]);
  }

  return (
    <AdminPage width="full">
      <AdminPageHeader
        eyebrow="Network intelligence"
        title="Circles"
        description="Local ecosystems where Cleanr can observe relationship density, coverage, opportunity, and value flow."
        actions={
          <>
            <AdminSecondaryButton onClick={() => { void loadCircles(); if (selectedCircleId) void loadCircleDetail(selectedCircleId); }}><RefreshCw className="h-4 w-4" /> Refresh</AdminSecondaryButton>
            <AdminPrimaryButton onClick={() => setShowCreate((value) => !value)}><Plus className="h-4 w-4" /> New Circle</AdminPrimaryButton>
          </>
        }
      />

      {success ? <AdminNotice tone="success">{success}</AdminNotice> : null}
      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      {showCreate ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-slate-950">Form a Circle</h2><p className="mt-1 text-xs text-slate-500">Membership stays explicit; geography never auto-enrolls people.</p></div><button type="button" onClick={() => setShowCreate(false)} className="text-xs font-semibold text-slate-500">Close</button></div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-slate-500">Name<input value={draft.name} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500">Slug<input value={draft.slug} onChange={(e) => setDraft((current) => ({ ...current, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500">Locality label<input value={draft.localityLabel} onChange={(e) => setDraft((current) => ({ ...current, localityLabel: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500">City<input value={draft.city} onChange={(e) => setDraft((current) => ({ ...current, city: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500">State / region<input value={draft.region} onChange={(e) => setDraft((current) => ({ ...current, region: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500">Country<input value={draft.country} onChange={(e) => setDraft((current) => ({ ...current, country: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500 md:col-span-3">Description<textarea value={draft.description} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
          </div>
          <div className="mt-4 flex justify-end"><AdminPrimaryButton disabled={creating} onClick={() => void createCircle()}>{creating ? "Creating…" : "Create Circle"}</AdminPrimaryButton></div>
        </div>
      ) : null}

      <section className="grid min-h-[720px] overflow-hidden rounded-2xl border border-slate-200 bg-white xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200 bg-slate-50/60">
          <div className="border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{circles.length} Circle{circles.length === 1 ? "" : "s"}</div>
          {loading ? <p className="p-4 text-sm text-slate-500">Loading Circles…</p> : circles.length === 0 ? <div className="p-6 text-center"><CircleDot className="mx-auto h-6 w-6 text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">No Circle formed yet</p></div> : circles.map((circle) => (
            <button key={circle.circle_id} type="button" onClick={() => { setSelectedCircleId(circle.circle_id); setView("overview"); }} className={`w-full border-b border-slate-200 px-4 py-4 text-left ${circle.circle_id === selectedCircleId ? "bg-white" : "hover:bg-white/70"}`}>
              <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-slate-950">{circle.name}</p><AdminStatus>{humanize(circle.status)}</AdminStatus></div>
              <p className="mt-1 text-xs text-slate-500">{circle.locality_label || [circle.city, circle.region].filter(Boolean).join(", ") || "Locality not set"}</p>
              <p className="mt-2 text-[11px] text-slate-500">{circle.member_count} members · {circle.active_service_relationships} relationships</p>
            </button>
          ))}
        </aside>

        {selected ? (
          <div className="min-w-0 p-6">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{selected.locality_label || "Local Circle"}</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{selected.name}</h2><p className="mt-1 text-xs text-slate-500">/{selected.slug} · {humanize(selected.status)}</p></div>
            </div>

            <div className="mt-2">
              <AdminTabs
                value={view}
                onChange={setView}
                items={[
                  { value: "overview", label: "Overview" },
                  { value: "members", label: "Members", count: activeMembers.length },
                  { value: "relationships", label: "Relationships", count: relationships.length },
                  { value: "value", label: "Value flow", count: valueFlow.length },
                  { value: "continuum", label: "Continuum" },
                  { value: "lifecycle", label: "Lifecycle" },
                ]}
              />
            </div>

            {detailLoading ? <p className="mt-6 text-sm text-slate-500">Loading Circle detail…</p> : null}

            {!detailLoading && view === "overview" ? (
              <div className="mt-5 space-y-5">
                <AdminStatStrip items={[
                  { label: "Members", value: selected.member_count, detail: `${selected.csp_count} CSPs · ${selected.household_count} customer accounts` },
                  { label: "Active relationships", value: selected.active_service_relationships, detail: `${selected.repeat_service_relationships} repeat` },
                  { label: "Coverage partners", value: selected.active_coverage_partnerships, detail: "Active trusted coverage ties" },
                  { label: "Opportunities", value: selected.opportunity_count, detail: `${selected.circulated_contribution_count} from circulated value` },
                ]} />
                <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-950">What these counts mean</summary><p className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-600">These are raw durable counts, not a synthetic community score. Density improves only when real relationships, coverage, contribution, and opportunity accumulate.</p></details>
              </div>
            ) : null}

            {!detailLoading && view === "members" ? (
              <div className="mt-5 grid gap-4 2xl:grid-cols-2">
                <AdminTableShell>
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Active members · {activeMembers.length}</div>
                  {activeMembers.length === 0 ? <p className="p-4 text-sm text-slate-500">No active members yet.</p> : activeMembers.map((person) => <div key={person.person_id} className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 last:border-b-0"><div><p className="text-sm font-semibold text-slate-950">{person.full_name || "Unnamed member"}</p><p className="mt-1 text-xs text-slate-500">{humanize(person.profile_role)} · {humanize(person.participation_role)}{person.zip_code ? ` · ${person.zip_code}` : ""}</p></div><AdminSecondaryButton disabled={busyPersonId === person.person_id} onClick={() => void setMember(person, false)}>End</AdminSecondaryButton></div>)}
                </AdminTableShell>
                <AdminTableShell>
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Available people</div>
                  <div className="max-h-[560px] overflow-y-auto">{availablePeople.length === 0 ? <p className="p-4 text-sm text-slate-500">No available people.</p> : availablePeople.map((person) => <div key={person.person_id} className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 last:border-b-0"><div><p className="text-sm font-semibold text-slate-950">{person.full_name || "Unnamed person"}</p><p className="mt-1 text-xs text-slate-500">{humanize(person.profile_role)}{person.zip_code ? ` · ${person.zip_code}` : ""}</p></div><AdminPrimaryButton disabled={busyPersonId === person.person_id} onClick={() => void setMember(person, true)}>Add</AdminPrimaryButton></div>)}</div>
                </AdminTableShell>
              </div>
            ) : null}

            {!detailLoading && view === "relationships" ? (
              <div className="mt-5 space-y-4">
                {[{ title: "Household ↔ CSP", rows: serviceEdges }, { title: "Network ties", rows: networkEdges }].map((group) => <AdminTableShell key={group.title}><div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group.title} · {group.rows.length}</div>{group.rows.length === 0 ? <p className="p-4 text-sm text-slate-500">No relationships in this group.</p> : group.rows.map((edge) => <div key={edge.connection_id} className="grid grid-cols-[minmax(260px,1.2fr)_170px_150px_minmax(220px,1fr)] gap-4 border-b border-slate-200 px-4 py-4 text-xs last:border-b-0"><p className="font-semibold text-slate-950">{edge.source_name || "Member"} ↔ {edge.target_name || "Member"}</p><p className="text-slate-600">{humanize(edge.relationship_kind)}</p><AdminStatus tone={edge.relationship_status === "active" ? "success" : "neutral"}>{humanize(edge.relationship_status)}</AdminStatus><p className="text-slate-500">Origin {humanize(edge.relationship_origin)} · last {dateLabel(edge.last_activity_at)}</p></div>)}</AdminTableShell>)}
              </div>
            ) : null}

            {!detailLoading && view === "value" ? (
              <div className="mt-5">{valueFlow.length === 0 ? <AdminEmptyState title="No verified value-flow evidence yet" /> : <AdminTableShell><div className="grid grid-cols-[minmax(240px,1fr)_170px_150px_minmax(300px,1.4fr)] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><span>Contributor</span><span>Contribution</span><span>Status</span><span>What it created</span></div>{valueFlow.map((row) => <div key={`${row.contribution_id}:${row.opportunity_id ?? "available"}`} className="grid grid-cols-[minmax(240px,1fr)_170px_150px_minmax(300px,1.4fr)] gap-4 border-b border-slate-200 px-4 py-4 text-xs last:border-b-0"><div><p className="font-semibold text-slate-950">{row.contributor_name || "Circle member"}</p><p className="mt-1 text-slate-500">{dateLabel(row.contribution_occurred_at)}</p></div><p className="text-slate-600">{humanize(row.contribution_type)}</p><AdminStatus tone={row.circulation_status === "circulated" ? "success" : "warning"}>{humanize(row.circulation_status)}</AdminStatus><div><p className="font-medium text-slate-900">{row.opportunity_id ? row.opportunity_title || humanize(row.opportunity_type) : "Available collective capacity"}</p>{row.capacity_reason ? <p className="mt-1 leading-5 text-slate-500">{row.capacity_reason}</p> : null}</div></div>)}</AdminTableShell>}</div>
            ) : null}

            {!detailLoading && view === "continuum" ? (
              <div className="mt-5 space-y-5">
                <AdminTableShell><div className="grid grid-cols-[minmax(260px,1fr)_120px_140px_140px] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><span>Participation</span><span>Active</span><span>Evidenced</span><span>Self-described</span></div>{continuumCapacity.map((row) => <div key={row.participation_key} className="grid grid-cols-[minmax(260px,1fr)_120px_140px_140px] gap-4 border-b border-slate-200 px-4 py-3 text-sm last:border-b-0"><p className="font-medium text-slate-900">{continuumLabel(row.participation_key)}</p><p>{row.active_count}</p><p>{row.evidenced_count}</p><p>{row.self_declared_count}</p></div>)}</AdminTableShell>
                <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-950">Member participation detail · {memberContinuum.length}</summary><div className="border-t border-slate-200">{activeMembers.map((person) => { const roles = participationByPerson.get(person.person_id) ?? []; return <div key={person.person_id} className="border-b border-slate-100 px-4 py-3 last:border-b-0"><p className="text-sm font-semibold text-slate-900">{person.full_name || "Unnamed member"}</p><p className="mt-1 text-xs text-slate-500">{roles.length ? roles.map((role) => `${continuumLabel(role.participation_key)} (${role.evidence_status})`).join(" · ") : "No active Continuum participation"}</p></div>; })}</div></details>
              </div>
            ) : null}

            {!detailLoading && view === "lifecycle" ? <div className="mt-5"><AdminCircleLifecycle circleId={selected.circle_id} circleStatus={selected.status} onChanged={() => loadCircles(selected.circle_id)} /></div> : null}
          </div>
        ) : <div className="p-8"><AdminEmptyState title="Select a Circle" /></div>}
      </section>
    </AdminPage>
  );
}
