import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Circle = { circle_id: string; name: string; locality_label: string | null; city: string | null; region: string | null };
type Candidate = { trigger_type: string; trigger_id: string; trigger_occurred_at: string; booking_id: string | null; customer_id: string; provider_id: string; signal_label: string; already_opened: boolean };
type RecoveryCase = { case_id: string; service_relationship_id: string; customer_id: string; provider_id: string; booking_id: string | null; trigger_type: string; trigger_occurred_at: string; status: string; outcome: string | null; outcome_evidence: string | null; created_at: string; updated_at: string; resolved_at: string | null };

function humanize(value: string | null | undefined) {
  if (!value) return "—";
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function AdminRelationshipRecovery() {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [scope, setScope] = useState("network");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidenceByCase, setEvidenceByCase] = useState<Record<string, string>>({});
  const [outcomeByCase, setOutcomeByCase] = useState<Record<string, string>>({});

  async function load(nextScope = scope) {
    setError(null);
    const nextCircleId = nextScope === "network" ? null : nextScope;
    const [circlesResult, candidatesResult, casesResult] = await Promise.all([
      supabase.rpc("get_admin_circle_overview"),
      supabase.rpc("get_admin_relationship_recovery_candidates", { p_circle_id: nextCircleId }),
      supabase.rpc("get_admin_relationship_recovery_cases", { p_circle_id: nextCircleId }),
    ]);
    const firstError = circlesResult.error ?? candidatesResult.error ?? casesResult.error;
    if (firstError) setError(firstError.message);
    if (!circlesResult.error) setCircles((circlesResult.data ?? []) as Circle[]);
    setCandidates(candidatesResult.error ? [] : (candidatesResult.data ?? []) as Candidate[]);
    setCases(casesResult.error ? [] : (casesResult.data ?? []) as RecoveryCase[]);
  }

  useEffect(() => { void load("network"); }, []);

  const unopened = useMemo(() => candidates.filter((candidate) => !candidate.already_opened), [candidates]);
  const activeCases = useMemo(() => cases.filter((item) => item.status !== "resolved"), [cases]);
  const resolvedCases = useMemo(() => cases.filter((item) => item.status === "resolved"), [cases]);

  async function openCase(candidate: Candidate) {
    if (busy) return;
    setBusy(candidate.trigger_id); setError(null);
    const { error: rpcError } = await supabase.rpc("admin_open_relationship_recovery_case", {
      p_trigger_type: candidate.trigger_type,
      p_trigger_id: candidate.trigger_id,
    });
    setBusy(null);
    if (rpcError) { setError(rpcError.message); return; }
    await load();
  }

  async function engageCase(item: RecoveryCase) {
    if (busy) return;
    setBusy(item.case_id); setError(null);
    const { error: rpcError } = await supabase.rpc("admin_update_relationship_recovery_case", {
      p_case_id: item.case_id,
      p_status: "engaged",
      p_outcome: null,
      p_outcome_evidence: null,
    });
    setBusy(null);
    if (rpcError) { setError(rpcError.message); return; }
    await load();
  }

  async function resolveCase(item: RecoveryCase) {
    if (busy) return;
    const outcome = outcomeByCase[item.case_id] || "unclear";
    const evidence = evidenceByCase[item.case_id]?.trim();
    if (!evidence) return;
    setBusy(item.case_id); setError(null);
    const { error: rpcError } = await supabase.rpc("admin_update_relationship_recovery_case", {
      p_case_id: item.case_id,
      p_status: "resolved",
      p_outcome: outcome,
      p_outcome_evidence: evidence,
    });
    setBusy(null);
    if (rpcError) { setError(rpcError.message); return; }
    setEvidenceByCase((current) => ({ ...current, [item.case_id]: "" }));
    await load();
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Relationship recovery</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Repair truth after real friction</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Open recovery cases only from a customer dispute or a 1–2 star review. A future booking never auto-means the relationship was repaired. Terminal outcomes require an explicit evidence basis.</p>
          </div>
          <button type="button" onClick={() => void load()} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"><RefreshCw size={15}/> Refresh</button>
        </div>
        <label className="mt-5 block max-w-sm text-xs font-semibold text-slate-600">Scope
          <select value={scope} onChange={(event) => { setScope(event.target.value); void load(event.target.value); }} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-900">
            <option value="network">Entire Cleanr network</option>
            {circles.map((circle) => <option key={circle.circle_id} value={circle.circle_id}>{circle.name}</option>)}
          </select>
        </label>
      </section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Friction signals not yet opened</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Only qualifying disputes and low reviews appear here. Incidents remain operational/safety evidence unless a separate relationship-friction signal exists.</p>
        {unopened.length === 0 ? <p className="mt-4 text-sm text-slate-500">No unopened recovery candidates in this scope.</p> : <div className="mt-4 space-y-3">{unopened.map((candidate) => <div key={`${candidate.trigger_type}:${candidate.trigger_id}`} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4"><div><p className="text-sm font-semibold text-slate-900">{candidate.signal_label}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(candidate.trigger_occurred_at)} · Booking {candidate.booking_id ? `…${candidate.booking_id.slice(-8)}` : "not linked"}</p></div><button type="button" disabled={busy === candidate.trigger_id} onClick={() => void openCase(candidate)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Open recovery case</button></div>)}</div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Active recovery cases</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">“Engaged” means a recovery effort is underway. Resolution should describe what supports the relationship outcome, not what Admin hopes happened.</p>
        {activeCases.length === 0 ? <p className="mt-4 text-sm text-slate-500">No active recovery cases.</p> : <div className="mt-4 space-y-4">{activeCases.map((item) => <div key={item.case_id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{humanize(item.trigger_type)}</p><p className="mt-1 text-xs text-slate-500">Triggered {dateLabel(item.trigger_occurred_at)} · {humanize(item.status)}</p></div>{item.status === "identified" ? <button type="button" disabled={busy === item.case_id} onClick={() => void engageCase(item)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">Mark engaged</button> : null}</div>
          <div className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
            <select value={outcomeByCase[item.case_id] ?? "unclear"} onChange={(event) => setOutcomeByCase((current) => ({ ...current, [item.case_id]: event.target.value }))} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900">
              <option value="relationship_continued">Relationship continued</option>
              <option value="relationship_ended">Relationship ended</option>
              <option value="unclear">Outcome still unclear</option>
            </select>
            <input value={evidenceByCase[item.case_id] ?? ""} onChange={(event) => setEvidenceByCase((current) => ({ ...current, [item.case_id]: event.target.value }))} placeholder="Evidence supporting this outcome" className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-900" />
            <button type="button" disabled={busy === item.case_id || !(evidenceByCase[item.case_id]?.trim())} onClick={() => void resolveCase(item)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Resolve</button>
          </div>
        </div>)}</div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Resolved recovery evidence</h2>
        {resolvedCases.length === 0 ? <p className="mt-4 text-sm text-slate-500">No resolved recovery cases yet.</p> : <div className="mt-4 space-y-3">{resolvedCases.map((item) => <div key={item.case_id} className="rounded-xl bg-slate-50 p-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-slate-900">{humanize(item.outcome)}</p><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">{humanize(item.trigger_type)}</span></div><p className="mt-2 text-sm text-slate-700">{item.outcome_evidence}</p><p className="mt-2 text-xs text-slate-500">Resolved {dateLabel(item.resolved_at)}</p></div>)}</div>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
        Relationship continuation is not the only good outcome. Respecting a boundary and ending a relationship can be the right resolution. Cleanr measures what happened; it does not pressure people to stay connected.
      </section>
    </main>
  );
}
