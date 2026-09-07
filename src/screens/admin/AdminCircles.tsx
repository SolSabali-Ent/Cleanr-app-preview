import { useEffect, useMemo, useState } from "react";
import { CircleDot, GitBranch, Plus, RefreshCw, Users } from "lucide-react";
import { supabase } from "../../lib/supabase";

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

type Draft = {
  name: string;
  slug: string;
  localityLabel: string;
  city: string;
  region: string;
  country: string;
  description: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  slug: "",
  localityLabel: "",
  city: "Atlanta",
  region: "GA",
  country: "US",
  description: "",
};

function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AdminCircles() {
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [relationships, setRelationships] = useState<RelationshipEdge[]>([]);
  const [valueFlow, setValueFlow] = useState<ValueFlowRow[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [busyPersonId, setBusyPersonId] = useState<string | null>(null);

  async function loadCircles(preferredId?: string | null) {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_circle_overview");
    if (rpcError) {
      setError(rpcError.message);
      setCircles([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as CircleRow[];
    setCircles(rows);
    const next = preferredId && rows.some((row) => row.circle_id === preferredId)
      ? preferredId
      : selectedCircleId && rows.some((row) => row.circle_id === selectedCircleId)
        ? selectedCircleId
        : rows[0]?.circle_id ?? null;
    setSelectedCircleId(next);
    setLoading(false);
  }

  async function loadCircleDetail(circleId: string) {
    setDetailLoading(true);
    const [peopleResult, relationshipsResult, valueFlowResult] = await Promise.all([
      supabase.rpc("get_admin_circle_people", { p_circle_id: circleId }),
      supabase.rpc("get_admin_circle_relationship_edges", { p_circle_id: circleId }),
      supabase.rpc("get_admin_circle_value_flow", { p_circle_id: circleId }),
    ]);

    const firstError = peopleResult.error ?? relationshipsResult.error ?? valueFlowResult.error;
    if (firstError) setError(firstError.message);

    setPeople(peopleResult.error ? [] : (peopleResult.data ?? []) as PersonRow[]);
    setRelationships(relationshipsResult.error ? [] : (relationshipsResult.data ?? []) as RelationshipEdge[]);
    setValueFlow(valueFlowResult.error ? [] : (valueFlowResult.data ?? []) as ValueFlowRow[]);
    setDetailLoading(false);
  }

  useEffect(() => { void loadCircles(); }, []);
  useEffect(() => {
    if (selectedCircleId) void loadCircleDetail(selectedCircleId);
    else {
      setPeople([]);
      setRelationships([]);
      setValueFlow([]);
    }
  }, [selectedCircleId]);

  const selected = useMemo(() => circles.find((row) => row.circle_id === selectedCircleId) ?? null, [circles, selectedCircleId]);
  const activeMembers = useMemo(() => people.filter((row) => row.membership_status === "active"), [people]);
  const availablePeople = useMemo(() => people.filter((row) => row.membership_status !== "active"), [people]);
  const serviceEdges = useMemo(() => relationships.filter((row) => row.connection_type === "service_relationship"), [relationships]);
  const networkEdges = useMemo(() => relationships.filter((row) => row.connection_type === "network_relationship"), [relationships]);

  async function createCircle() {
    if (draft.name.trim().length < 2 || !draft.slug.trim()) {
      setError("Add a Circle name and slug.");
      return;
    }
    setCreating(true);
    setError(null);
    setSuccess(null);
    const { data, error: rpcError } = await supabase.rpc("admin_create_cleanr_circle", {
      p_name: draft.name.trim(),
      p_slug: draft.slug.trim().toLowerCase(),
      p_locality_label: draft.localityLabel.trim() || null,
      p_city: draft.city.trim() || null,
      p_region: draft.region.trim() || null,
      p_country: draft.country.trim() || "US",
      p_description: draft.description.trim() || null,
    });
    setCreating(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const row = data as { id?: string; name?: string } | null;
    setSuccess(`Created ${row?.name ?? draft.name.trim()} as a forming Cleanr Circle.`);
    setDraft(EMPTY_DRAFT);
    setShowCreate(false);
    await loadCircles(row?.id ?? null);
  }

  async function setMember(person: PersonRow, active: boolean) {
    if (!selectedCircleId || busyPersonId) return;
    setBusyPersonId(person.person_id);
    setError(null);
    const { error: rpcError } = await supabase.rpc("admin_set_circle_member", {
      p_circle_id: selectedCircleId,
      p_person_id: person.person_id,
      p_participation_role: person.participation_role ?? "member",
      p_status: active ? "active" : "ended",
      p_provenance_type: "admin",
    });
    setBusyPersonId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await Promise.all([loadCircleDetail(selectedCircleId), loadCircles(selectedCircleId)]);
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Cleanr Circles</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Local relationship density + collective capacity</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              A Circle is a durable local ecosystem container—not a feed or chat room. It lets Cleanr observe what households and CSPs in one place can actually do together: sustain relationships, provide coverage, create opportunity, and circulate value.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { void loadCircles(); if (selectedCircleId) void loadCircleDetail(selectedCircleId); }} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
              <RefreshCw size={15} /> Refresh
            </button>
            <button type="button" onClick={() => setShowCreate((value) => !value)} className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
              <Plus size={15} /> New Circle
            </button>
          </div>
        </div>
      </section>

      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {showCreate ? (
        <section className="rounded-2xl border border-emerald-200 bg-white p-6">
          <h2 className="font-semibold text-slate-950">Form a local Circle</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Membership remains explicit. Creating a Circle does not auto-enroll anyone by ZIP code or geography.</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Name<input value={draft.name} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} placeholder="Atlanta Founding Circle" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-600">Slug<input value={draft.slug} onChange={(e) => setDraft((current) => ({ ...current, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") }))} placeholder="atlanta-founding-circle" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-600">Locality label<input value={draft.localityLabel} onChange={(e) => setDraft((current) => ({ ...current, localityLabel: e.target.value }))} placeholder="Atlanta metro" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-600">City<input value={draft.city} onChange={(e) => setDraft((current) => ({ ...current, city: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-600">State / region<input value={draft.region} onChange={(e) => setDraft((current) => ({ ...current, region: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-600">Country<input value={draft.country} onChange={(e) => setDraft((current) => ({ ...current, country: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-600 md:col-span-2">Description<textarea value={draft.description} onChange={(e) => setDraft((current) => ({ ...current, description: e.target.value }))} rows={3} placeholder="What this local Circle is being formed to learn or support." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
          </div>
          <div className="mt-5 flex justify-end"><button type="button" disabled={creating} onClick={() => void createCircle()} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{creating ? "Creating…" : "Create forming Circle"}</button></div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-950">Circles</h2></div>
          {loading ? <p className="p-4 text-sm text-slate-500">Loading Circles…</p> : circles.length === 0 ? (
            <div className="p-6 text-center"><CircleDot className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">No Circle formed yet.</p><p className="mt-1 text-xs text-slate-500">Create the first local laboratory when you are ready.</p></div>
          ) : (
            <div className="divide-y divide-slate-100">{circles.map((circle) => (
              <button key={circle.circle_id} type="button" onClick={() => setSelectedCircleId(circle.circle_id)} className={`w-full px-4 py-4 text-left ${circle.circle_id === selectedCircleId ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
                <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-950">{circle.name}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{humanize(circle.status)}</span></div>
                <p className="mt-1 text-xs text-slate-500">{circle.locality_label || [circle.city, circle.region].filter(Boolean).join(", ") || "Locality not set"}</p>
                <p className="mt-2 text-xs text-slate-600">{circle.csp_count} CSP · {circle.household_count} households · {circle.active_service_relationships} active relationships</p>
              </button>
            ))}</div>
          )}
        </div>

        {selected ? (
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{selected.locality_label || "Local Circle"}</p><h2 className="mt-1 text-xl font-bold text-slate-950">{selected.name}</h2><p className="mt-1 text-xs text-slate-500">/{selected.slug} · {humanize(selected.status)}</p></div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-right"><p className="text-2xl font-bold text-slate-950">{selected.member_count}</p><p className="text-xs text-slate-500">active members</p></div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[['CSPs', selected.csp_count], ['Households', selected.household_count], ['Active relationships', selected.active_service_relationships], ['Repeat relationships', selected.repeat_service_relationships], ['Coverage partnerships', selected.active_coverage_partnerships], ['Contributions', selected.contribution_count], ['Opportunities created', selected.opportunity_count], ['Value circulated', selected.circulated_contribution_count]].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">These are raw durable counts, not a synthetic community score. Density should improve because real relationships, coverage and opportunity accumulate.</p>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="font-semibold text-slate-950">Circle membership</h3><p className="mt-1 text-xs text-slate-500">Explicit membership only. Auth roles do not change.</p></div><Users size={18} className="text-slate-400" /></div>
              {detailLoading ? <p className="p-5 text-sm text-slate-500">Loading Circle detail…</p> : (
                <div className="grid gap-0 lg:grid-cols-2">
                  <div className="border-b border-slate-200 lg:border-b-0 lg:border-r"><div className="bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Active members · {activeMembers.length}</div><div className="divide-y divide-slate-100">{activeMembers.map((person) => (
                    <div key={person.person_id} className="flex items-center justify-between gap-3 px-5 py-3"><div><p className="text-sm font-medium text-slate-900">{person.full_name || "Unnamed member"}</p><p className="mt-1 text-xs text-slate-500">{humanize(person.profile_role)} · {humanize(person.participation_role)}{person.zip_code ? ` · ${person.zip_code}` : ""}</p></div><button type="button" disabled={busyPersonId === person.person_id} onClick={() => void setMember(person, false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-50">End</button></div>
                  ))}{activeMembers.length === 0 ? <p className="px-5 py-5 text-sm text-slate-500">No active members yet.</p> : null}</div></div>
                  <div><div className="bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Available people</div><div className="max-h-[420px] divide-y divide-slate-100 overflow-y-auto">{availablePeople.map((person) => (
                    <div key={person.person_id} className="flex items-center justify-between gap-3 px-5 py-3"><div><p className="text-sm font-medium text-slate-900">{person.full_name || "Unnamed person"}</p><p className="mt-1 text-xs text-slate-500">{humanize(person.profile_role)}{person.zip_code ? ` · ${person.zip_code}` : ""}</p></div><button type="button" disabled={busyPersonId === person.person_id} onClick={() => void setMember(person, true)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Add</button></div>
                  ))}</div></div>
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="font-semibold text-slate-950">Human ties inside this Circle</h3><p className="mt-1 text-xs text-slate-500">Durable service and network relationships only; no private household notes are exposed here.</p></div><GitBranch size={18} className="text-slate-400" /></div>
              <div className="grid lg:grid-cols-2">
                <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
                  <div className="bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Household ↔ CSP · {serviceEdges.length}</div>
                  <div className="divide-y divide-slate-100">{serviceEdges.map((edge) => (
                    <div key={edge.connection_id} className="px-5 py-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{edge.source_name || "CSP"} ↔ {edge.target_name || "Household"}</p><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{humanize(edge.relationship_status)}</span></div><p className="mt-1 text-xs text-slate-500">{humanize(edge.relationship_kind)} · origin: {humanize(edge.relationship_origin)}</p><p className="mt-2 text-xs text-slate-600">{edge.evidence_count ?? 0} completed services · last activity {dateLabel(edge.last_activity_at)}</p></div>
                  ))}{serviceEdges.length === 0 ? <p className="px-5 py-5 text-sm text-slate-500">No in-Circle service relationship yet.</p> : null}</div>
                </div>
                <div>
                  <div className="bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">CSP / network ties · {networkEdges.length}</div>
                  <div className="divide-y divide-slate-100">{networkEdges.map((edge) => (
                    <div key={edge.connection_id} className="px-5 py-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-900">{edge.source_name || "Member"} ↔ {edge.target_name || "Member"}</p><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{humanize(edge.relationship_status)}</span></div><p className="mt-1 text-xs text-slate-500">{humanize(edge.relationship_kind)} · origin: {humanize(edge.relationship_origin)}</p><p className="mt-2 text-xs text-slate-600">Started {dateLabel(edge.started_at)} · last activity {dateLabel(edge.last_activity_at)}</p></div>
                  ))}{networkEdges.length === 0 ? <p className="px-5 py-5 text-sm text-slate-500">No in-Circle coverage, mentor, peer or collaborator tie yet.</p> : null}</div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-4"><h3 className="font-semibold text-slate-950">Value flow inside this Circle</h3><p className="mt-1 text-xs text-slate-500">Shows what members created and whether that verified value has been converted into another Growth opportunity.</p></div>
              <div className="divide-y divide-slate-100">{valueFlow.map((row) => (
                <div key={`${row.contribution_id}:${row.opportunity_id ?? "available"}`} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{row.contributor_name || "Circle member"} created {humanize(row.contribution_type)}</p><p className="mt-1 text-xs text-slate-500">{humanize(row.contributor_profile_role)} · {dateLabel(row.contribution_occurred_at)} · source: {humanize(row.contribution_source_type)}</p></div><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.circulation_status === "circulated" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{humanize(row.circulation_status)}</span></div>
                  {row.opportunity_id ? <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Created opportunity</p><p className="mt-1 text-sm font-semibold text-slate-900">{row.opportunity_title || humanize(row.opportunity_type)}</p><p className="mt-1 text-xs text-slate-600">{humanize(row.opportunity_type)} · {humanize(row.opportunity_status)}</p>{row.capacity_reason ? <p className="mt-2 text-xs leading-5 text-slate-600">Why this value made the opportunity possible: {row.capacity_reason}</p> : null}</div> : <p className="mt-2 text-xs text-slate-500">This verified contribution remains available collective capacity.</p>}
                </div>
              ))}{valueFlow.length === 0 ? <p className="px-5 py-5 text-sm text-slate-500">No verified contribution/value-flow evidence inside this Circle yet.</p> : null}</div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
