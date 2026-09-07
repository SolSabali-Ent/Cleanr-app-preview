import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Circle = {
  circle_id: string;
  name: string;
  locality_label: string | null;
  city: string | null;
  region: string | null;
};

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

const DEMAND_TYPES = ["service","coverage","training","business_support","product","vendor","opportunity","housing","capital","other"];
const SOURCE_TYPES = ["admin_observation","household_request","csp_request","service_activity","spend_pattern","external_demand","other"];
const STATUSES = ["observed","validated","exploring","acted","retired"];

function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AdminCollectiveDemand() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircleId, setSelectedCircleId] = useState<string>("");
  const [signals, setSignals] = useState<DemandSignal[]>([]);
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

  async function loadCircles() {
    setLoading(true);
    const { data, error: rpcError } = await supabase.rpc("get_admin_circle_overview");
    if (rpcError) {
      setError(rpcError.message);
      setCircles([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Circle[];
    setCircles(rows);
    if (!selectedCircleId && rows[0]?.circle_id) setSelectedCircleId(rows[0].circle_id);
    setLoading(false);
  }

  async function loadSignals(circleId: string) {
    if (!circleId) { setSignals([]); return; }
    const { data, error: rpcError } = await supabase.rpc("get_admin_circle_demand_signals", { p_circle_id: circleId });
    if (rpcError) {
      setError(rpcError.message);
      setSignals([]);
      return;
    }
    setSignals((data ?? []) as DemandSignal[]);
  }

  useEffect(() => { void loadCircles(); }, []);
  useEffect(() => { if (selectedCircleId) void loadSignals(selectedCircleId); }, [selectedCircleId]);

  const selectedCircle = useMemo(() => circles.find((circle) => circle.circle_id === selectedCircleId) ?? null, [circles, selectedCircleId]);

  async function createSignal() {
    if (!selectedCircleId || label.trim().length < 3 || observationNote.trim().length < 3 || busy) return;
    setBusy(true); setError(null); setSuccess(null);
    const { error: rpcError } = await supabase.rpc("admin_create_circle_demand_signal", {
      p_circle_id: selectedCircleId,
      p_demand_type: demandType,
      p_label: label.trim(),
      p_description: description.trim() || null,
      p_source_type: sourceType,
      p_source_ref: sourceRef.trim() || null,
      p_observation_note: observationNote.trim(),
    });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    setLabel(""); setDescription(""); setSourceRef(""); setObservationNote(""); setShowCreate(false);
    setSuccess("Demand signal recorded with its first observation.");
    await loadSignals(selectedCircleId);
  }

  async function addObservation(signal: DemandSignal) {
    const note = repeatNoteBySignal[signal.signal_id]?.trim();
    if (!note || busy) return;
    setBusy(true); setError(null); setSuccess(null);
    const { error: rpcError } = await supabase.rpc("admin_add_circle_demand_observation", {
      p_signal_id: signal.signal_id,
      p_source_type: "admin_observation",
      p_source_ref: null,
      p_observation_note: note,
    });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    setRepeatNoteBySignal((current) => ({ ...current, [signal.signal_id]: "" }));
    setSuccess(`Added recurrence evidence to ${signal.label}.`);
    await loadSignals(selectedCircleId);
  }

  async function setStatus(signalId: string, status: string) {
    if (busy) return;
    setBusy(true); setError(null); setSuccess(null);
    const { error: rpcError } = await supabase.rpc("admin_set_circle_demand_signal_status", { p_signal_id: signalId, p_status: status });
    setBusy(false);
    if (rpcError) { setError(rpcError.message); return; }
    await loadSignals(selectedCircleId);
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Collective demand</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">What this Circle repeatedly needs</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Capture recurring needs as evidence before Cleanr decides whether a new opportunity, vendor relationship, negotiated service, or future vertical is warranted. Signals do not create businesses or opportunities automatically.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { void loadCircles(); if (selectedCircleId) void loadSignals(selectedCircleId); }} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><RefreshCw size={15}/> Refresh</button>
            <button type="button" onClick={() => setShowCreate((value) => !value)} disabled={!selectedCircleId} className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"><Plus size={15}/> New signal</button>
          </div>
        </div>
        <div className="mt-5 max-w-md">
          <label className="text-xs font-semibold text-slate-600">Circle
            <select value={selectedCircleId} onChange={(event) => setSelectedCircleId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900">
              {circles.map((circle) => <option key={circle.circle_id} value={circle.circle_id}>{circle.name}</option>)}
            </select>
          </label>
          {selectedCircle ? <p className="mt-2 text-xs text-slate-500">{selectedCircle.locality_label || [selectedCircle.city, selectedCircle.region].filter(Boolean).join(", ") || "Locality not set"}</p> : null}
        </div>
      </section>

      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {showCreate ? <section className="rounded-2xl border border-emerald-200 bg-white p-6">
        <h2 className="font-semibold text-slate-950">Record an observed need</h2>
        <p className="mt-1 text-xs text-slate-500">Use purpose-limited evidence. Do not put household names, sensitive notes, or unnecessary PII into the observation.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">Demand type<select value={demandType} onChange={(e) => setDemandType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900">{DEMAND_TYPES.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Signal label<input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Reliable childcare during weekday cleans" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900"/></label>
          <label className="text-xs font-semibold text-slate-600 md:col-span-2">Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900"/></label>
          <label className="text-xs font-semibold text-slate-600">Evidence source<select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900">{SOURCE_TYPES.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-600">Optional source reference<input value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="Internal record/reference only" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900"/></label>
          <label className="text-xs font-semibold text-slate-600 md:col-span-2">First observation<textarea value={observationNote} onChange={(e) => setObservationNote(e.target.value)} rows={3} placeholder="Describe the observed need without unnecessary personal detail." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900"/></label>
        </div>
        <div className="mt-5 flex justify-end"><button type="button" disabled={busy || label.trim().length < 3 || observationNote.trim().length < 3} onClick={() => void createSignal()} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">Record signal</button></div>
      </section> : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-950">Demand evidence</h2><p className="mt-1 text-xs text-slate-500">Recurrence is the number of durable observations, not a manually typed score.</p></div>
        {loading ? <p className="p-5 text-sm text-slate-500">Loading…</p> : signals.length === 0 ? <p className="p-5 text-sm text-slate-500">No demand signals recorded for this Circle yet.</p> : <div className="divide-y divide-slate-100">{signals.map((signal) => <div key={signal.signal_id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{signal.label}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{humanize(signal.demand_type)}</span></div>{signal.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{signal.description}</p> : null}<p className="mt-2 text-xs text-slate-500">{signal.observation_count} observation{signal.observation_count === 1 ? "" : "s"} · first {dateLabel(signal.first_observed_at)} · latest {dateLabel(signal.last_observed_at)}</p></div>
            <select value={signal.status} disabled={busy} onChange={(e) => void setStatus(signal.signal_id, e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{STATUSES.map((status) => <option key={status} value={status}>{humanize(status)}</option>)}</select>
          </div>
          {signal.latest_observation_note ? <div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Latest observation</p><p className="mt-1 text-sm text-slate-700">{signal.latest_observation_note}</p><p className="mt-2 text-xs text-slate-500">Source: {humanize(signal.latest_source_type)}</p></div> : null}
          {signal.status !== "retired" ? <div className="mt-4 flex gap-2"><input value={repeatNoteBySignal[signal.signal_id] ?? ""} onChange={(e) => setRepeatNoteBySignal((current) => ({ ...current, [signal.signal_id]: e.target.value }))} placeholder="Add another observation when this need recurs" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900"/><button type="button" disabled={busy || !(repeatNoteBySignal[signal.signal_id]?.trim())} onClick={() => void addObservation(signal)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Add observation</button></div> : null}
        </div>)}</div>}
      </section>
    </main>
  );
}
