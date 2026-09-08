import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
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

type Circle = { circle_id: string; name: string; locality_label: string | null; city: string | null; region: string | null };
type Candidate = { trigger_type: string; trigger_id: string; trigger_occurred_at: string; booking_id: string | null; customer_id: string; provider_id: string; signal_label: string; already_opened: boolean };
type RecoveryCase = { case_id: string; service_relationship_id: string; customer_id: string; provider_id: string; booking_id: string | null; trigger_type: string; trigger_occurred_at: string; status: string; outcome: string | null; outcome_evidence: string | null; created_at: string; updated_at: string; resolved_at: string | null };
type View = "signals" | "active" | "resolved";

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
  const [view, setView] = useState<View>("signals");
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
    setView("active");
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
    <AdminPage width="wide">
      <AdminPageHeader
        eyebrow="Relationship health"
        title="Recovery"
        description="Track friction signals and document what actually happened after a recovery effort."
        actions={
          <>
            <label className="text-xs font-semibold text-slate-500">
              Scope
              <select
                value={scope}
                onChange={(event) => { setScope(event.target.value); void load(event.target.value); }}
                className="ml-2 min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-900"
              >
                <option value="network">Entire network</option>
                {circles.map((circle) => <option key={circle.circle_id} value={circle.circle_id}>{circle.name}</option>)}
              </select>
            </label>
            <AdminSecondaryButton onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</AdminSecondaryButton>
          </>
        }
      />

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      <AdminTabs
        value={view}
        onChange={setView}
        items={[
          { value: "signals", label: "Signals", count: unopened.length },
          { value: "active", label: "Active", count: activeCases.length },
          { value: "resolved", label: "Resolved", count: resolvedCases.length },
        ]}
      />

      {view === "signals" ? (
        unopened.length === 0 ? (
          <AdminEmptyState title="No unopened recovery signals" description="Qualifying disputes and low reviews will appear here when a relationship may need attention." />
        ) : (
          <AdminTableShell>
            <div className="grid grid-cols-[minmax(260px,1.2fr)_180px_180px_180px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Signal</span><span>Triggered</span><span>Booking</span><span className="text-right">Action</span>
            </div>
            {unopened.map((candidate) => (
              <div key={`${candidate.trigger_type}:${candidate.trigger_id}`} className="grid grid-cols-[minmax(260px,1.2fr)_180px_180px_180px] items-center gap-4 border-b border-slate-200 px-5 py-4 last:border-b-0">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{candidate.signal_label}</p>
                  <p className="mt-1 text-xs text-slate-500">{humanize(candidate.trigger_type)}</p>
                </div>
                <p className="text-xs text-slate-500">{dateLabel(candidate.trigger_occurred_at)}</p>
                <p className="font-mono text-xs text-slate-500">{candidate.booking_id ? `…${candidate.booking_id.slice(-8)}` : "—"}</p>
                <div className="text-right"><AdminPrimaryButton disabled={busy === candidate.trigger_id} onClick={() => void openCase(candidate)}>Open case</AdminPrimaryButton></div>
              </div>
            ))}
          </AdminTableShell>
        )
      ) : null}

      {view === "active" ? (
        activeCases.length === 0 ? (
          <AdminEmptyState title="No active recovery cases" />
        ) : (
          <div className="space-y-3">
            {activeCases.map((item) => (
              <div key={item.case_id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-950">{humanize(item.trigger_type)}</p>
                      <AdminStatus tone={item.status === "engaged" ? "info" : "warning"}>{humanize(item.status)}</AdminStatus>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Triggered {dateLabel(item.trigger_occurred_at)}{item.booking_id ? ` · Booking …${item.booking_id.slice(-8)}` : ""}</p>
                  </div>
                  {item.status === "identified" ? <AdminSecondaryButton disabled={busy === item.case_id} onClick={() => void engageCase(item)}>Mark engaged</AdminSecondaryButton> : null}
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                  <select value={outcomeByCase[item.case_id] ?? "unclear"} onChange={(event) => setOutcomeByCase((current) => ({ ...current, [item.case_id]: event.target.value }))} className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900">
                    <option value="relationship_continued">Relationship continued</option>
                    <option value="relationship_ended">Relationship ended</option>
                    <option value="unclear">Outcome still unclear</option>
                  </select>
                  <input value={evidenceByCase[item.case_id] ?? ""} onChange={(event) => setEvidenceByCase((current) => ({ ...current, [item.case_id]: event.target.value }))} placeholder="Evidence supporting this outcome" className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-900" />
                  <AdminPrimaryButton disabled={busy === item.case_id || !(evidenceByCase[item.case_id]?.trim())} onClick={() => void resolveCase(item)}>Resolve</AdminPrimaryButton>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {view === "resolved" ? (
        resolvedCases.length === 0 ? (
          <AdminEmptyState title="No resolved recovery cases yet" />
        ) : (
          <AdminTableShell>
            <div className="grid grid-cols-[180px_170px_minmax(320px,1.5fr)_190px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Trigger</span><span>Outcome</span><span>Evidence</span><span>Resolved</span>
            </div>
            {resolvedCases.map((item) => (
              <div key={item.case_id} className="grid grid-cols-[180px_170px_minmax(320px,1.5fr)_190px] gap-4 border-b border-slate-200 px-5 py-4 text-xs last:border-b-0">
                <p className="font-medium text-slate-900">{humanize(item.trigger_type)}</p>
                <AdminStatus tone={item.outcome === "relationship_continued" ? "success" : item.outcome === "relationship_ended" ? "neutral" : "warning"}>{humanize(item.outcome)}</AdminStatus>
                <p className="leading-5 text-slate-600">{item.outcome_evidence || "—"}</p>
                <p className="text-slate-500">{dateLabel(item.resolved_at)}</p>
              </div>
            ))}
          </AdminTableShell>
        )
      ) : null}

      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">Recovery rules</summary>
        <p className="border-t border-slate-200 px-5 py-4 text-xs leading-5 text-slate-600">
          A future booking does not automatically mean a relationship was repaired. Resolution records the outcome supported by evidence; respecting a boundary and ending a relationship can also be the right result.
        </p>
      </details>
    </AdminPage>
  );
}
