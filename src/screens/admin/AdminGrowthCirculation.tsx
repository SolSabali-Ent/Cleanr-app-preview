import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { AdminOutcomeContributionRecorder } from "./AdminOutcomeContributionRecorder";
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

type OpportunityRow = {
  opportunity_id: string; opportunity_type: string; title: string; description: string | null; status: string; visibility: string; geographic_scope: string | null; created_at: string;
  source_contribution_count: number; source_contributor_names: string[] | null; capacity_reasons: string[] | null; suggested_count: number; interested_count: number; offered_count: number; accepted_count: number; declined_count: number; completed_count: number; outcome_count: number; downstream_contribution_count: number;
};
type CandidateRow = { person_id: string; full_name: string | null; role: string | null; north_star_goal: string | null; north_star_category: string | null; capability_labels: string[] | null; time_preference: string | null; location_preference: string | null; travel_radius_miles: number | null; fit_notes: string | null; introductions_enabled: boolean; already_matched: boolean };
type MatchRow = { match_id: string; person_id: string; full_name: string | null; role: string | null; status: string; match_source: string; match_reason: string | null; north_star_alignment: string | null; capability_alignment: string | null; interest_alignment: string | null; constraint_fit: string | null; matched_at: string; offered_at: string | null; updated_at: string; outcome_id: string | null; outcome_summary: string | null; outcome_source_system: string | null; outcome_occurred_at: string | null; downstream_contribution_count: number; downstream_contribution_types: string[] | null };
type MatchDraft = { reason: string; northStar: string; capability: string; interest: string; constraint: string };
type View = "pool" | "matches" | "outcomes";
const EMPTY_MATCH_DRAFT: MatchDraft = { reason: "", northStar: "", capability: "", interest: "", constraint: "" };

function label(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function shortDate(value: string | null) { if (!value) return "—"; const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
function matchTone(status: string) { return status === "completed" ? "success" as const : status === "accepted" || status === "offered" ? "info" as const : status === "declined" ? "neutral" as const : "warning" as const; }

export function AdminGrowthCirculation() {
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("pool");
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [matchDraft, setMatchDraft] = useState<MatchDraft>(EMPTY_MATCH_DRAFT);
  const [completionSummary, setCompletionSummary] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selected = useMemo(() => opportunities.find((item) => item.opportunity_id === selectedId) ?? null, [opportunities, selectedId]);
  const outcomeMatches = useMemo(() => matches.filter((match) => Boolean(match.outcome_id)), [matches]);

  async function loadOpportunities() {
    setLoading(true); setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_growth_opportunity_circulation");
    if (rpcError) { setOpportunities([]); setError(rpcError.message); }
    else {
      const next = (data ?? []) as OpportunityRow[]; setOpportunities(next);
      setSelectedId((current) => current && next.some((row) => row.opportunity_id === current) ? current : next[0]?.opportunity_id ?? null);
    }
    setLoading(false);
  }

  async function loadSelected(opportunityId: string | null) {
    if (!opportunityId) { setCandidates([]); setMatches([]); return; }
    const [{ data: candidateData, error: candidateError }, { data: matchData, error: matchError }] = await Promise.all([
      supabase.rpc("get_admin_growth_opportunity_candidate_pool", { p_opportunity_id: opportunityId }),
      supabase.rpc("get_admin_growth_opportunity_matches", { p_opportunity_id: opportunityId }),
    ]);
    if (candidateError || matchError) return setError(candidateError?.message ?? matchError?.message ?? "Unable to load opportunity circulation");
    setCandidates((candidateData ?? []) as CandidateRow[]); setMatches((matchData ?? []) as MatchRow[]);
  }

  useEffect(() => { void loadOpportunities(); }, []);
  useEffect(() => { void loadSelected(selectedId); }, [selectedId]);

  async function refreshAll() { await loadOpportunities(); await loadSelected(selectedId); }

  function startMatch(candidate: CandidateRow) {
    setSelectedCandidateId(candidate.person_id); setError(null); setSuccess(null);
    setMatchDraft({ reason: `Admin selected this opted-in member for review against ${selected?.title ?? "this opportunity"}.`, northStar: candidate.north_star_goal ? `Potential fit with North Star: ${candidate.north_star_goal}` : "", capability: candidate.capability_labels?.length ? `Relevant capabilities: ${candidate.capability_labels.join(", ")}` : "", interest: selected ? `Member opted into ${label(selected.opportunity_type)} opportunities.` : "", constraint: [candidate.time_preference, candidate.location_preference].filter(Boolean).join(" · ") });
  }

  async function createMatch() {
    if (!selected || !selectedCandidateId) return;
    setBusy(`match:${selectedCandidateId}`); setError(null);
    const { error: rpcError } = await supabase.rpc("create_growth_opportunity_match", { p_opportunity_id: selected.opportunity_id, p_person_id: selectedCandidateId, p_match_source: "admin", p_match_reason: matchDraft.reason.trim() || null, p_north_star_alignment: matchDraft.northStar.trim() || null, p_capability_alignment: matchDraft.capability.trim() || null, p_interest_alignment: matchDraft.interest.trim() || null, p_constraint_fit: matchDraft.constraint.trim() || null });
    setBusy(null); if (rpcError) return setError(rpcError.message);
    setSelectedCandidateId(null); setMatchDraft(EMPTY_MATCH_DRAFT); setSuccess("Suggested match recorded. The person still decides whether they are interested."); setView("matches"); await refreshAll();
  }

  async function offer(match: MatchRow) {
    setBusy(`offer:${match.match_id}`); setError(null);
    const { error: rpcError } = await supabase.rpc("offer_growth_opportunity_match", { p_match_id: match.match_id });
    setBusy(null); if (rpcError) return setError(rpcError.message); setSuccess("Offer recorded. Acceptance still belongs to the person."); await refreshAll();
  }

  async function complete(match: MatchRow) {
    const summary = (completionSummary[match.match_id] ?? "").trim();
    if (summary.length < 3) return setError("Add a short verification summary before marking the opportunity completed.");
    setBusy(`complete:${match.match_id}`); setError(null);
    const { error: rpcError } = await supabase.rpc("complete_growth_opportunity_match", { p_match_id: match.match_id, p_source_system: "admin", p_outcome_summary: summary });
    setBusy(null); if (rpcError) return setError(rpcError.message); setSuccess("Verified outcome recorded."); setView("outcomes"); await refreshAll();
  }

  return (
    <AdminPage width="full">
      <AdminPageHeader
        eyebrow="Network intelligence"
        title="Opportunity circulation"
        description="Operate consent, match, offer, acceptance, and verified outcome boundaries without replacing Kinex orchestration."
        actions={<AdminSecondaryButton disabled={loading} onClick={() => void refreshAll()}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</AdminSecondaryButton>}
      />

      {success ? <AdminNotice tone="success">{success}</AdminNotice> : null}
      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading opportunities…</div> : opportunities.length === 0 ? <AdminEmptyState title="No Growth opportunities yet" description="Create one from verified value in Collective Capacity." /> : (
        <div className="grid min-h-[720px] overflow-hidden rounded-2xl border border-slate-200 bg-white xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="border-r border-slate-200 bg-slate-50/60">
            <div className="border-b border-slate-200 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{opportunities.length} opportunities</div>
            {opportunities.map((opportunity) => <button key={opportunity.opportunity_id} type="button" onClick={() => { setSelectedId(opportunity.opportunity_id); setView("pool"); }} className={`w-full border-b border-slate-200 px-4 py-4 text-left ${selectedId === opportunity.opportunity_id ? "bg-white" : "hover:bg-white/70"}`}><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-slate-950">{opportunity.title}</p><AdminStatus>{label(opportunity.status)}</AdminStatus></div><p className="mt-1 text-xs text-slate-500">{label(opportunity.opportunity_type)}</p><p className="mt-2 text-[11px] text-slate-500">{opportunity.interested_count} interested · {opportunity.accepted_count} accepted · {opportunity.completed_count} completed</p></button>)}
          </aside>

          {selected ? (
            <section className="min-w-0 p-6">
              <div className="border-b border-slate-200 pb-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label(selected.opportunity_type)}</p><h2 className="mt-1 text-xl font-semibold text-slate-950">{selected.title}</h2>{selected.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{selected.description}</p> : null}</div><AdminStatus tone="info">{label(selected.status)}</AdminStatus></div>{selected.capacity_reasons?.length ? <p className="mt-3 text-xs leading-5 text-slate-500">Created from: {selected.capacity_reasons.join(" · ")}</p> : null}</div>

              <div className="mt-2"><AdminTabs value={view} onChange={setView} items={[{ value: "pool", label: "Eligible pool", count: candidates.filter((candidate) => !candidate.already_matched).length }, { value: "matches", label: "Matches", count: matches.length }, { value: "outcomes", label: "Outcomes", count: outcomeMatches.length }]} /></div>

              {view === "pool" ? (
                <div className="mt-5">{candidates.length === 0 ? <AdminEmptyState title="Nobody has opted into this opportunity type yet" /> : <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">{candidates.map((candidate) => <div key={candidate.person_id} className="px-4 py-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-semibold text-slate-950">{candidate.full_name || "Cleanr member"}</p>{candidate.north_star_goal ? <p className="mt-1 text-xs text-slate-600">North Star: {candidate.north_star_goal}</p> : null}{candidate.capability_labels?.length ? <p className="mt-1 text-xs text-slate-500">{candidate.capability_labels.join(", ")}</p> : null}<p className="mt-1 text-[11px] text-slate-400">{[candidate.time_preference, candidate.location_preference, candidate.travel_radius_miles != null ? `${candidate.travel_radius_miles} mi` : null].filter(Boolean).join(" · ") || "No additional fit constraints"}</p></div>{candidate.already_matched ? <AdminStatus>Already matched</AdminStatus> : <AdminSecondaryButton onClick={() => startMatch(candidate)}>Review match</AdminSecondaryButton>}</div>
                  {selectedCandidateId === candidate.person_id ? <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-2"><label className="text-xs font-semibold text-slate-500 md:col-span-2">Why this may fit<textarea rows={2} value={matchDraft.reason} onChange={(e) => setMatchDraft((d) => ({ ...d, reason: e.target.value }))} className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label><label className="text-xs font-semibold text-slate-500">North Star alignment<textarea rows={2} value={matchDraft.northStar} onChange={(e) => setMatchDraft((d) => ({ ...d, northStar: e.target.value }))} className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label><label className="text-xs font-semibold text-slate-500">Capability alignment<textarea rows={2} value={matchDraft.capability} onChange={(e) => setMatchDraft((d) => ({ ...d, capability: e.target.value }))} className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label><label className="text-xs font-semibold text-slate-500">Interest alignment<textarea rows={2} value={matchDraft.interest} onChange={(e) => setMatchDraft((d) => ({ ...d, interest: e.target.value }))} className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label><label className="text-xs font-semibold text-slate-500">Constraint fit<textarea rows={2} value={matchDraft.constraint} onChange={(e) => setMatchDraft((d) => ({ ...d, constraint: e.target.value }))} className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label><div className="flex justify-end gap-2 md:col-span-2"><AdminSecondaryButton onClick={() => setSelectedCandidateId(null)}>Cancel</AdminSecondaryButton><AdminPrimaryButton disabled={busy === `match:${candidate.person_id}`} onClick={() => void createMatch()}>Create suggested match <ArrowRight className="h-4 w-4" /></AdminPrimaryButton></div></div> : null}
                </div>)}</div>}</div>
              ) : null}

              {view === "matches" ? (
                <div className="mt-5">{matches.length === 0 ? <AdminEmptyState title="No matches yet" /> : <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">{matches.map((match) => <div key={match.match_id} className="px-4 py-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-950">{match.full_name || "Cleanr member"}</p><AdminStatus tone={matchTone(match.status)}>{label(match.status)}</AdminStatus></div>{match.match_reason ? <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{match.match_reason}</p> : null}<p className="mt-1 text-[11px] text-slate-400">Matched {shortDate(match.matched_at)} · {match.match_source}</p></div>{match.status === "interested" ? <AdminPrimaryButton disabled={busy === `offer:${match.match_id}`} onClick={() => void offer(match)}>Offer opportunity</AdminPrimaryButton> : null}</div>{match.status === "accepted" ? <div className="mt-4 flex gap-2 rounded-xl bg-emerald-50 p-4"><textarea rows={2} value={completionSummary[match.match_id] ?? ""} onChange={(e) => setCompletionSummary((current) => ({ ...current, [match.match_id]: e.target.value }))} placeholder="Verification summary" className="min-w-0 flex-1 resize-none rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900" /><AdminPrimaryButton disabled={busy === `complete:${match.match_id}`} onClick={() => void complete(match)}><CheckCircle2 className="h-4 w-4" /> Verify outcome</AdminPrimaryButton></div> : null}</div>)}</div>}</div>
              ) : null}

              {view === "outcomes" ? (
                <div className="mt-5">{outcomeMatches.length === 0 ? <AdminEmptyState title="No verified outcomes yet" /> : <div className="space-y-3">{outcomeMatches.map((match) => <div key={match.match_id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-950">{match.full_name || "Cleanr member"}</p><AdminStatus tone="success">Verified</AdminStatus></div><p className="mt-2 text-xs leading-5 text-slate-600">{match.outcome_summary || "Completion verified."}</p>{match.downstream_contribution_count > 0 ? <p className="mt-3 text-xs font-semibold text-blue-800">Value re-entered as: {match.downstream_contribution_types?.map(label).join(", ")}</p> : match.outcome_id ? <div className="mt-3"><AdminOutcomeContributionRecorder opportunityId={selected.opportunity_id} outcomeId={match.outcome_id} busy={busy === `contribution:${match.match_id}`} onBusy={(isBusy) => setBusy(isBusy ? `contribution:${match.match_id}` : null)} onError={setError} onSuccess={setSuccess} onRecorded={refreshAll} /></div> : null}</div>)}</div>}</div>
              ) : null}
            </section>
          ) : <div className="p-8"><AdminEmptyState title="Select an opportunity" /></div>}
        </div>
      )}

      <details className="rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">Circulation boundary</summary><p className="border-t border-slate-200 px-5 py-4 text-xs leading-5 text-slate-600">This workspace persists explicit product truth only: opt-in eligibility, suggested matches, offers, person-controlled acceptance, verified outcomes, and downstream contributions. It does not rank people or replace Kinex orchestration.</p></details>
    </AdminPage>
  );
}
