import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Unlink } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { AdminDemandOpportunityPanel } from "./AdminDemandOpportunityPanel";
import { AdminDemandSpendEvidence } from "./AdminDemandSpendEvidence";
import { AdminDemandActionEvidence } from "./AdminDemandActionEvidence";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminStatus,
  AdminTabs,
} from "./AdminUi";

type Circle = { circle_id: string; name: string; locality_label: string | null; city: string | null; region: string | null };
type DemandSignal = {
  signal_id: string;
  demand_type: string;
  label: string;
  description: string | null;
  status: string;
  observation_count: number;
  source_types: string[];
  first_observed_at: string | null;
  last_observed_at: string | null;
  latest_observation_note: string | null;
  latest_source_type: string | null;
  latest_source_ref: string | null;
};
type DemandCapacityLink = {
  link_id: string;
  signal_id: string;
  signal_label: string;
  signal_status: string;
  participation_key: string;
  relevance_reason: string;
  active_people_count: number;
  evidenced_people_count: number;
  self_declared_people_count: number;
};
type View = "signals" | "actions" | "spend";

const DEMAND_TYPES = ["service","coverage","training","business_support","product","vendor","opportunity","housing","capital","other"];
const SOURCE_TYPES = ["admin_observation","household_request","csp_request","service_activity","external_demand","other"];
const STATUSES = ["observed","validated","exploring","retired"];
const PARTICIPATION_KEYS = ["service_provider","coverage_partner","collaborator","mentor","business_owner","vendor","employer","investor","advisor","opportunity_creator"];
const PARTICIPATION_LABELS: Record<string, string> = {
  service_provider: "Residential service provider", coverage_partner: "Trusted coverage partner", collaborator: "Collaborator", mentor: "Mentor", business_owner: "Business owner", vendor: "Vendor", employer: "Employer", investor: "Investor", advisor: "Advisor", opportunity_creator: "Opportunity creator",
};

function humanize(value: string | null | undefined) { return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—"; }
function participationLabel(value: string) { return PARTICIPATION_LABELS[value] ?? humanize(value); }
function dateLabel(value: string | null | undefined) { return value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"; }
function statusTone(status: string) { return status === "validated" ? "success" as const : status === "exploring" ? "info" as const : status === "retired" ? "neutral" as const : "warning" as const; }

export function AdminCollectiveDemand() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string>("");
  const [signals, setSignals] = useState<DemandSignal[]>([]);
  const [capacityLinks, setCapacityLinks] = useState<DemandCapacityLink[]>([]);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [view, setView] = useState<View>("signals");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [demandType, setDemandType] = useState("service");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState("admin_observation");
  const [sourceRef, setSourceRef] = useState("");
  const [observationNote, setObservationNote] = useState("");
  const [repeatNoteBySignal, setRepeatNoteBySignal] = useState<Record<string, string>>({});
  const [capacityKeyBySignal, setCapacityKeyBySignal] = useState<Record<string, string>>({});
  const [capacityReasonBySignal, setCapacityReasonBySignal] = useState<Record<string, string>>({});

  async function loadCircles() {
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("get_admin_circle_overview");
    if (rpcError) { setError(rpcError.message); setCircles([]); setLoading(false); return; }
    const rows = (data ?? []) as Circle[];
    setCircles(rows);
    if (!selectedCircleId && rows[0]?.circle_id) setSelectedCircleId(rows[0].circle_id);
    setLoading(false);
  }

  async function loadDemandDetail(circleId: string) {
    if (!circleId) { setSignals([]); setCapacityLinks([]); setSelectedSignalId(null); return; }
    const [signalsResult, linksResult] = await Promise.all([
      supabase.rpc("get_admin_circle_demand_signals", { p_circle_id: circleId }),
      supabase.rpc("get_admin_circle_demand_capacity", { p_circle_id: circleId }),
    ]);
    const firstError = signalsResult.error ?? linksResult.error;
    if (firstError) setError(firstError.message);
    const nextSignals = signalsResult.error ? [] : (signalsResult.data ?? []) as DemandSignal[];
    setSignals(nextSignals);
    setCapacityLinks(linksResult.error ? [] : (linksResult.data ?? []) as DemandCapacityLink[]);
    setSelectedSignalId((current) => current && nextSignals.some((signal) => signal.signal_id === current) ? current : nextSignals[0]?.signal_id ?? null);
  }

  useEffect(() => { void loadCircles(); }, []);
  useEffect(() => { if (selectedCircleId) void loadDemandDetail(selectedCircleId); }, [selectedCircleId]);

  const selectedCircle = useMemo(() => circles.find((circle) => circle.circle_id === selectedCircleId) ?? null, [circles, selectedCircleId]);
  const selectedSignal = useMemo(() => signals.find((signal) => signal.signal_id === selectedSignalId) ?? null, [signals, selectedSignalId]);
  const linksBySignal = useMemo(() => {
    const grouped = new Map<string, DemandCapacityLink[]>();
    for (const link of capacityLinks) { const current = grouped.get(link.signal_id) ?? []; current.push(link); grouped.set(link.signal_id, current); }
    return grouped;
  }, [capacityLinks]);

  async function createSignal() {
    if (!selectedCircleId || label.trim().length < 3 || observationNote.trim().length < 3 || busy) return;
    setBusy(true); setError(null); setSuccess(null);
    const { error: rpcError } = await supabase.rpc("admin_create_circle_demand_signal", {
      p_circle_id: selectedCircleId, p_demand_type: demandType, p_label: label.trim(), p_description: description.trim() || null,
      p_source_type: sourceType, p_source_ref: sourceRef.trim() || null, p_observation_note: observationNote.trim(),
    });
    setBusy(false);
    if (rpcError) return setError(rpcError.message);
    setLabel(""); setDescription(""); setSourceRef(""); setObservationNote(""); setShowCreate(false); setSuccess("Demand signal recorded."); await loadDemandDetail(selectedCircleId);
  }

  async function addObservation(signal: DemandSignal) {
    const note = repeatNoteBySignal[signal.signal_id]?.trim(); if (!note || busy) return;
    setBusy(true); setError(null); setSuccess(null);
    const { error: rpcError } = await supabase.rpc("admin_add_circle_demand_observation", { p_signal_id: signal.signal_id, p_source_type: "admin_observation", p_source_ref: null, p_observation_note: note });
    setBusy(false); if (rpcError) return setError(rpcError.message);
    setRepeatNoteBySignal((current) => ({ ...current, [signal.signal_id]: "" })); setSuccess(`Added recurrence evidence to ${signal.label}.`); await loadDemandDetail(selectedCircleId);
  }

  async function setStatus(signalId: string, status: string) {
    if (busy) return; setBusy(true); setError(null); setSuccess(null);
    const { error: rpcError } = await supabase.rpc("admin_set_circle_demand_signal_status", { p_signal_id: signalId, p_status: status });
    setBusy(false); if (rpcError) return setError(rpcError.message); await loadDemandDetail(selectedCircleId);
  }

  async function linkCapacity(signal: DemandSignal) {
    const key = capacityKeyBySignal[signal.signal_id] || PARTICIPATION_KEYS[0];
    const reason = capacityReasonBySignal[signal.signal_id]?.trim(); if (!reason || busy) return;
    setBusy(true); setError(null); setSuccess(null);
    const { error: rpcError } = await supabase.rpc("admin_link_circle_demand_capacity", { p_signal_id: signal.signal_id, p_participation_key: key, p_relevance_reason: reason });
    setBusy(false); if (rpcError) return setError(rpcError.message);
    setCapacityReasonBySignal((current) => ({ ...current, [signal.signal_id]: "" })); setSuccess(`Linked ${participationLabel(key)} capacity to ${signal.label}.`); await loadDemandDetail(selectedCircleId);
  }

  async function unlinkCapacity(link: DemandCapacityLink) {
    if (busy) return; setBusy(true); setError(null); setSuccess(null);
    const { error: rpcError } = await supabase.rpc("admin_unlink_circle_demand_capacity", { p_link_id: link.link_id });
    setBusy(false); if (rpcError) return setError(rpcError.message); setSuccess(`Removed ${participationLabel(link.participation_key)} from ${link.signal_label}.`); await loadDemandDetail(selectedCircleId);
  }

  return (
    <AdminPage width="full">
      <AdminPageHeader
        eyebrow="Network intelligence"
        title="Collective demand"
        description="Track repeated needs, the evidence behind them, and which existing Circle capacity may be relevant."
        actions={
          <>
            <label className="text-xs font-semibold text-slate-500">Circle<select value={selectedCircleId} onChange={(event) => setSelectedCircleId(event.target.value)} className="ml-2 min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900">{circles.map((circle) => <option key={circle.circle_id} value={circle.circle_id}>{circle.name}</option>)}</select></label>
            <AdminSecondaryButton onClick={() => { void loadCircles(); if (selectedCircleId) void loadDemandDetail(selectedCircleId); }}><RefreshCw className="h-4 w-4" /> Refresh</AdminSecondaryButton>
            <AdminPrimaryButton disabled={!selectedCircleId} onClick={() => setShowCreate((value) => !value)}><Plus className="h-4 w-4" /> New signal</AdminPrimaryButton>
          </>
        }
        meta={selectedCircle ? <span className="text-xs text-slate-500">{selectedCircle.locality_label || [selectedCircle.city, selectedCircle.region].filter(Boolean).join(", ")}</span> : undefined}
      />

      {success ? <AdminNotice tone="success">{success}</AdminNotice> : null}
      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      {showCreate ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-slate-950">Record an observed need</h2><p className="mt-1 text-xs text-slate-500">Use purpose-limited evidence and avoid unnecessary household details.</p></div><button type="button" onClick={() => setShowCreate(false)} className="text-xs font-semibold text-slate-500">Close</button></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-500">Demand type<select value={demandType} onChange={(e) => setDemandType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900">{DEMAND_TYPES.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-500">Signal label<input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500 md:col-span-2">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500">Evidence source<select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900">{SOURCE_TYPES.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-500">Source reference<input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
            <label className="text-xs font-semibold text-slate-500 md:col-span-2">First observation<textarea value={observationNote} onChange={(e) => setObservationNote(e.target.value)} rows={2} className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900" /></label>
          </div>
          <div className="mt-4 flex justify-end"><AdminPrimaryButton disabled={busy || label.trim().length < 3 || observationNote.trim().length < 3} onClick={() => void createSignal()}>Record signal</AdminPrimaryButton></div>
        </div>
      ) : null}

      <AdminTabs value={view} onChange={setView} items={[{ value: "signals", label: "Signals", count: signals.length }, { value: "actions", label: "Action evidence" }, { value: "spend", label: "Spend evidence" }]} />

      {view === "signals" ? (
        signals.length === 0 && !loading ? <AdminEmptyState title="No demand signals yet" description="Record a repeated need when you have evidence it matters to this Circle." /> : (
          <div className="grid min-h-[650px] overflow-hidden rounded-2xl border border-slate-200 bg-white xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="border-r border-slate-200 bg-slate-50/60">
              <div className="border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{signals.length} signal{signals.length === 1 ? "" : "s"}</div>
              {signals.map((signal) => <button key={signal.signal_id} type="button" onClick={() => setSelectedSignalId(signal.signal_id)} className={`w-full border-b border-slate-200 px-4 py-4 text-left ${selectedSignal?.signal_id === signal.signal_id ? "bg-white" : "hover:bg-white/70"}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-slate-950">{signal.label}</p><AdminStatus tone={statusTone(signal.status)}>{humanize(signal.status)}</AdminStatus></div><p className="mt-1 text-xs text-slate-500">{humanize(signal.demand_type)} · {signal.observation_count} observation{signal.observation_count === 1 ? "" : "s"}</p><p className="mt-2 text-[11px] text-slate-400">Latest {dateLabel(signal.last_observed_at)}</p></button>)}
            </aside>

            {selectedSignal ? (
              <section className="min-w-0 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold text-slate-950">{selectedSignal.label}</h2><AdminStatus tone={statusTone(selectedSignal.status)}>{humanize(selectedSignal.status)}</AdminStatus></div>{selectedSignal.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selectedSignal.description}</p> : null}<p className="mt-2 text-xs text-slate-500">{selectedSignal.observation_count} observations · first {dateLabel(selectedSignal.first_observed_at)} · latest {dateLabel(selectedSignal.last_observed_at)}</p></div><select value={selectedSignal.status} disabled={busy} onChange={(e) => void setStatus(selectedSignal.signal_id, e.target.value)} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700">{selectedSignal.status === "acted" ? <option value="acted" disabled>Acted</option> : null}{STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select></div>

                {selectedSignal.latest_observation_note ? <div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Latest observation</p><p className="mt-2 text-sm leading-6 text-slate-700">{selectedSignal.latest_observation_note}</p><p className="mt-2 text-xs text-slate-500">Source: {humanize(selectedSignal.latest_source_type)}</p></div> : null}

                <div className="mt-5 border-t border-slate-200 pt-5">
                  <div className="flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-950">Relevant Circle capacity</h3><p className="mt-1 text-xs text-slate-500">Context only; linking capacity does not select a person or initiate work.</p></div></div>
                  {(linksBySignal.get(selectedSignal.signal_id) ?? []).length === 0 ? <p className="mt-3 text-sm text-slate-500">No capacity linked yet.</p> : <div className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200">{(linksBySignal.get(selectedSignal.signal_id) ?? []).map((link) => <div key={link.link_id} className="flex items-start justify-between gap-4 px-4 py-3"><div><p className="text-sm font-semibold text-slate-900">{participationLabel(link.participation_key)}</p><p className="mt-1 text-xs leading-5 text-slate-600">{link.relevance_reason}</p><p className="mt-1 text-[11px] text-slate-500">{link.active_people_count} active · {link.evidenced_people_count} evidenced · {link.self_declared_people_count} self-described</p></div><button type="button" disabled={busy} onClick={() => void unlinkCapacity(link)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700" aria-label="Remove capacity link"><Unlink className="h-4 w-4" /></button></div>)}</div>}

                  {selectedSignal.status !== "retired" ? <div className="mt-3 grid gap-2 md:grid-cols-[220px_minmax(0,1fr)_auto]"><select value={capacityKeyBySignal[selectedSignal.signal_id] ?? PARTICIPATION_KEYS[0]} onChange={(e) => setCapacityKeyBySignal((current) => ({ ...current, [selectedSignal.signal_id]: e.target.value }))} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900">{PARTICIPATION_KEYS.map((key) => <option key={key} value={key}>{participationLabel(key)}</option>)}</select><input value={capacityReasonBySignal[selectedSignal.signal_id] ?? ""} onChange={(e) => setCapacityReasonBySignal((current) => ({ ...current, [selectedSignal.signal_id]: e.target.value }))} placeholder="Why this capacity appears relevant" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900" /><AdminSecondaryButton disabled={busy || !(capacityReasonBySignal[selectedSignal.signal_id]?.trim())} onClick={() => void linkCapacity(selectedSignal)}>Link capacity</AdminSecondaryButton></div> : null}
                </div>

                <div className="mt-5 border-t border-slate-200 pt-5"><AdminDemandOpportunityPanel circleId={selectedCircleId} signalId={selectedSignal.signal_id} signalLabel={selectedSignal.label} signalStatus={selectedSignal.status} onCreated={() => loadDemandDetail(selectedCircleId)} /></div>

                {selectedSignal.status !== "retired" ? <div className="mt-5 flex gap-2 border-t border-slate-200 pt-5"><input value={repeatNoteBySignal[selectedSignal.signal_id] ?? ""} onChange={(e) => setRepeatNoteBySignal((current) => ({ ...current, [selectedSignal.signal_id]: e.target.value }))} placeholder="Add recurrence evidence" className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-900" /><AdminPrimaryButton disabled={busy || !(repeatNoteBySignal[selectedSignal.signal_id]?.trim())} onClick={() => void addObservation(selectedSignal)}>Add observation</AdminPrimaryButton></div> : null}
              </section>
            ) : <div className="p-8"><AdminEmptyState title="Select a demand signal" /></div>}
          </div>
        )
      ) : null}

      {view === "actions" && selectedCircleId ? <AdminDemandActionEvidence circleId={selectedCircleId} signals={signals.map((signal) => ({ signalId: signal.signal_id, label: signal.label, status: signal.status }))} onRecorded={() => loadDemandDetail(selectedCircleId)} /> : null}
      {view === "spend" && selectedCircleId ? <AdminDemandSpendEvidence circleId={selectedCircleId} signals={signals.map((signal) => ({ signalId: signal.signal_id, label: signal.label, status: signal.status }))} onRecorded={() => loadDemandDetail(selectedCircleId)} /> : null}
    </AdminPage>
  );
}
