import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, RefreshCw, Users } from "lucide-react";
import { supabase } from "../../lib/supabase";

type OpportunityRow = {
  opportunity_id: string;
  opportunity_type: string;
  title: string;
  description: string | null;
  status: string;
  visibility: string;
  geographic_scope: string | null;
  created_at: string;
  source_contribution_count: number;
  source_contributor_names: string[] | null;
  capacity_reasons: string[] | null;
  suggested_count: number;
  interested_count: number;
  offered_count: number;
  accepted_count: number;
  declined_count: number;
  completed_count: number;
  outcome_count: number;
  downstream_contribution_count: number;
};

type CandidateRow = {
  person_id: string;
  full_name: string | null;
  role: string | null;
  north_star_goal: string | null;
  north_star_category: string | null;
  capability_labels: string[] | null;
  time_preference: string | null;
  location_preference: string | null;
  travel_radius_miles: number | null;
  fit_notes: string | null;
  introductions_enabled: boolean;
  already_matched: boolean;
};

type MatchRow = {
  match_id: string;
  person_id: string;
  full_name: string | null;
  role: string | null;
  status: string;
  match_source: string;
  match_reason: string | null;
  north_star_alignment: string | null;
  capability_alignment: string | null;
  interest_alignment: string | null;
  constraint_fit: string | null;
  matched_at: string;
  offered_at: string | null;
  updated_at: string;
  outcome_id: string | null;
  outcome_summary: string | null;
  outcome_source_system: string | null;
  outcome_occurred_at: string | null;
  downstream_contribution_count: number;
  downstream_contribution_types: string[] | null;
};

type MatchDraft = {
  reason: string;
  northStar: string;
  capability: string;
  interest: string;
  constraint: string;
};

const EMPTY_MATCH_DRAFT: MatchDraft = { reason: "", northStar: "", capability: "", interest: "", constraint: "" };
const CONTRIBUTION_TYPES = ["knowledge", "opportunity_created", "employment_created", "business_created", "leadership"] as const;

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function AdminGrowthCirculation() {
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [matchDraft, setMatchDraft] = useState<MatchDraft>(EMPTY_MATCH_DRAFT);
  const [completionSummary, setCompletionSummary] = useState<Record<string, string>>({});
  const [contributionDraft, setContributionDraft] = useState<Record<string, { type: string; evidence: string }>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selected = useMemo(() => opportunities.find((item) => item.opportunity_id === selectedId) ?? null, [opportunities, selectedId]);

  async function loadOpportunities() {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_growth_opportunity_circulation");
    if (rpcError) {
      setOpportunities([]);
      setError(rpcError.message);
    } else {
      const next = (data ?? []) as OpportunityRow[];
      setOpportunities(next);
      if (!selectedId && next.length > 0) setSelectedId(next[0].opportunity_id);
      if (selectedId && !next.some((row) => row.opportunity_id === selectedId)) setSelectedId(next[0]?.opportunity_id ?? null);
    }
    setLoading(false);
  }

  async function loadSelected(opportunityId: string | null) {
    if (!opportunityId) {
      setCandidates([]);
      setMatches([]);
      return;
    }
    const [{ data: candidateData, error: candidateError }, { data: matchData, error: matchError }] = await Promise.all([
      supabase.rpc("get_admin_growth_opportunity_candidate_pool", { p_opportunity_id: opportunityId }),
      supabase.rpc("get_admin_growth_opportunity_matches", { p_opportunity_id: opportunityId }),
    ]);
    if (candidateError || matchError) {
      setError(candidateError?.message ?? matchError?.message ?? "Unable to load opportunity circulation");
      return;
    }
    setCandidates((candidateData ?? []) as CandidateRow[]);
    setMatches((matchData ?? []) as MatchRow[]);
  }

  useEffect(() => { void loadOpportunities(); }, []);
  useEffect(() => { void loadSelected(selectedId); }, [selectedId]);

  async function refreshAll() {
    await loadOpportunities();
    await loadSelected(selectedId);
  }

  function startMatch(candidate: CandidateRow) {
    setSelectedCandidateId(candidate.person_id);
    setError(null);
    setSuccess(null);
    setMatchDraft({
      reason: `Admin selected this opted-in member for review against ${selected?.title ?? "this opportunity"}.`,
      northStar: candidate.north_star_goal ? `Potential fit with North Star: ${candidate.north_star_goal}` : "",
      capability: candidate.capability_labels?.length ? `Relevant capabilities: ${candidate.capability_labels.join(", ")}` : "",
      interest: selected ? `Member opted into ${label(selected.opportunity_type)} opportunities.` : "",
      constraint: [candidate.time_preference, candidate.location_preference].filter(Boolean).join(" · "),
    });
  }

  async function createMatch() {
    if (!selected || !selectedCandidateId) return;
    setBusy(`match:${selectedCandidateId}`);
    setError(null);
    const { error: rpcError } = await supabase.rpc("create_growth_opportunity_match", {
      p_opportunity_id: selected.opportunity_id,
      p_person_id: selectedCandidateId,
      p_match_source: "admin",
      p_match_reason: matchDraft.reason.trim() || null,
      p_north_star_alignment: matchDraft.northStar.trim() || null,
      p_capability_alignment: matchDraft.capability.trim() || null,
      p_interest_alignment: matchDraft.interest.trim() || null,
      p_constraint_fit: matchDraft.constraint.trim() || null,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSelectedCandidateId(null);
    setMatchDraft(EMPTY_MATCH_DRAFT);
    setSuccess("Suggested match recorded. The person still decides whether they are interested.");
    await refreshAll();
  }

  async function offer(match: MatchRow) {
    setBusy(`offer:${match.match_id}`);
    setError(null);
    const { error: rpcError } = await supabase.rpc("offer_growth_opportunity_match", { p_match_id: match.match_id });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSuccess("Offer recorded. Acceptance still belongs to the person.");
    await refreshAll();
  }

  async function complete(match: MatchRow) {
    const summary = (completionSummary[match.match_id] ?? "").trim();
    if (summary.length < 3) {
      setError("Add a short verification summary before marking the opportunity completed.");
      return;
    }
    setBusy(`complete:${match.match_id}`);
    setError(null);
    const { error: rpcError } = await supabase.rpc("complete_growth_opportunity_match", {
      p_match_id: match.match_id,
      p_source_system: "admin",
      p_outcome_summary: summary,
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSuccess("Verified outcome recorded. This is now durable completion truth in Cleanr.");
    await refreshAll();
  }

  async function recordContribution(match: MatchRow) {
    if (!match.outcome_id) return;
    const draft = contributionDraft[match.match_id] ?? { type: "knowledge", evidence: "" };
    if (draft.evidence.trim().length < 3) {
      setError("Add evidence explaining what new value this outcome created.");
      return;
    }
    setBusy(`contribution:${match.match_id}`);
    setError(null);
    const { error: rpcError } = await supabase.rpc("record_growth_outcome_contribution", {
      p_outcome_id: match.outcome_id,
      p_contribution_type: draft.type,
      p_evidence_summary: draft.evidence.trim(),
      p_beneficiary_person_id: null,
      p_metadata: {},
    });
    setBusy(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setSuccess("Downstream contribution recorded. The value loop now re-enters Collective Capacity.");
    await refreshAll();
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">Opportunity circulation</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">From collective capacity to verified outcome</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Cleanr persists consent, matches, offers, acceptance, outcomes, and contribution provenance. This workspace does not rank people or replace Kinex orchestration; it only operates the durable boundaries already in the product.
            </p>
          </div>
          <button type="button" onClick={() => void refreshAll()} disabled={loading} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </section>

      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading opportunities…</div> : opportunities.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Users className="mx-auto h-7 w-7 text-slate-400" />
          <p className="mt-3 font-semibold text-slate-800">No Growth opportunities exist yet.</p>
          <p className="mt-1 text-sm text-slate-500">Create one from verified value in Collective Capacity. It will appear here automatically.</p>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-3">
            {opportunities.map((opportunity) => (
              <button key={opportunity.opportunity_id} type="button" onClick={() => setSelectedId(opportunity.opportunity_id)} className={`w-full rounded-2xl border p-4 text-left ${selectedId === opportunity.opportunity_id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-700">{label(opportunity.opportunity_type)}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{opportunity.status}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-950">{opportunity.title}</p>
                <p className="mt-2 text-xs text-slate-500">{opportunity.source_contribution_count} source · {opportunity.completed_count} completed · {opportunity.downstream_contribution_count} new contributions</p>
              </button>
            ))}
          </aside>

          {selected ? (
            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{label(selected.opportunity_type)}</p>
                    <h2 className="mt-1 text-xl font-bold text-slate-950">{selected.title}</h2>
                    {selected.description ? <p className="mt-2 text-sm leading-6 text-slate-600">{selected.description}</p> : null}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="font-bold text-slate-950">{selected.interested_count}</p><p className="text-slate-500">Interested</p></div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="font-bold text-slate-950">{selected.accepted_count}</p><p className="text-slate-500">Accepted</p></div>
                    <div className="rounded-lg bg-slate-50 px-3 py-2"><p className="font-bold text-slate-950">{selected.completed_count}</p><p className="text-slate-500">Completed</p></div>
                  </div>
                </div>
                {(selected.capacity_reasons?.length ?? 0) > 0 ? <div className="mt-4 rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-800"><strong>Created from:</strong> {selected.capacity_reasons?.join(" · ")}</div> : null}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h3 className="font-semibold text-slate-950">Consent-eligible pool</h3>
                  <p className="mt-1 text-xs text-slate-500">Unranked. These people explicitly enabled matching and selected this opportunity type.</p>
                </div>
                {candidates.length === 0 ? <p className="p-5 text-sm text-slate-500">Nobody has opted into this type yet.</p> : <div className="divide-y divide-slate-100">{candidates.map((candidate) => (
                  <div key={candidate.person_id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-950">{candidate.full_name || "Cleanr member"} <span className="font-normal text-slate-400">· {candidate.role || "member"}</span></p>
                        {candidate.north_star_goal ? <p className="mt-1 text-xs text-slate-600"><strong>North Star:</strong> {candidate.north_star_goal}</p> : null}
                        {candidate.capability_labels?.length ? <p className="mt-1 text-xs text-slate-500">Capabilities: {candidate.capability_labels.join(", ")}</p> : null}
                        <p className="mt-1 text-xs text-slate-500">{[candidate.time_preference, candidate.location_preference, candidate.travel_radius_miles != null ? `${candidate.travel_radius_miles} mi` : null].filter(Boolean).join(" · ") || "No additional fit constraints saved"}</p>
                      </div>
                      {candidate.already_matched ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">Already matched</span> : <button type="button" onClick={() => startMatch(candidate)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Review match</button>}
                    </div>
                    {selectedCandidateId === candidate.person_id ? (
                      <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
                        <label className="text-xs font-semibold text-slate-600 md:col-span-2">Why this may fit<textarea rows={2} value={matchDraft.reason} onChange={(e) => setMatchDraft((d) => ({ ...d, reason: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label>
                        <label className="text-xs font-semibold text-slate-600">North Star alignment<textarea rows={2} value={matchDraft.northStar} onChange={(e) => setMatchDraft((d) => ({ ...d, northStar: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label>
                        <label className="text-xs font-semibold text-slate-600">Capability alignment<textarea rows={2} value={matchDraft.capability} onChange={(e) => setMatchDraft((d) => ({ ...d, capability: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label>
                        <label className="text-xs font-semibold text-slate-600">Interest alignment<textarea rows={2} value={matchDraft.interest} onChange={(e) => setMatchDraft((d) => ({ ...d, interest: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label>
                        <label className="text-xs font-semibold text-slate-600">Constraint fit<textarea rows={2} value={matchDraft.constraint} onChange={(e) => setMatchDraft((d) => ({ ...d, constraint: e.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900" /></label>
                        <div className="flex justify-end gap-2 md:col-span-2"><button type="button" onClick={() => setSelectedCandidateId(null)} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-500">Cancel</button><button type="button" onClick={() => void createMatch()} disabled={busy === `match:${candidate.person_id}`} className="flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Create suggested match <ArrowRight size={13} /></button></div>
                      </div>
                    ) : null}
                  </div>
                ))}</div>}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <h3 className="font-semibold text-slate-950">Match lifecycle</h3>
                  <p className="mt-1 text-xs text-slate-500">Person-controlled interest and acceptance stay intact. Admin only operates privileged transitions and verifies real-world outcomes.</p>
                </div>
                {matches.length === 0 ? <p className="p-5 text-sm text-slate-500">No matches yet.</p> : <div className="divide-y divide-slate-100">{matches.map((match) => (
                  <div key={match.match_id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2"><p className="text-sm font-semibold text-slate-950">{match.full_name || "Cleanr member"}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{label(match.status)}</span></div>
                        {match.match_reason ? <p className="mt-1 text-xs leading-5 text-slate-500">{match.match_reason}</p> : null}
                        <p className="mt-1 text-[11px] text-slate-400">Matched {shortDate(match.matched_at)} · {match.match_source}</p>
                      </div>
                      {match.status === "interested" ? <button type="button" onClick={() => void offer(match)} disabled={busy === `offer:${match.match_id}`} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Offer opportunity</button> : null}
                    </div>

                    {match.status === "accepted" ? <div className="mt-4 rounded-xl bg-emerald-50 p-4"><p className="text-xs font-semibold text-emerald-800">Accepted by the person</p><textarea rows={2} value={completionSummary[match.match_id] ?? ""} onChange={(e) => setCompletionSummary((current) => ({ ...current, [match.match_id]: e.target.value }))} placeholder="What happened in the real world? Add verification before completion." className="mt-2 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900" /><div className="mt-2 flex justify-end"><button type="button" onClick={() => void complete(match)} disabled={busy === `complete:${match.match_id}`} className="flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><CheckCircle2 size={13} /> Verify completed outcome</button></div></div> : null}

                    {match.outcome_id ? <div className="mt-4 rounded-xl bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-800">Verified outcome</p><p className="mt-1 text-xs leading-5 text-blue-700">{match.outcome_summary || "Completion verified."}</p>{match.downstream_contribution_count > 0 ? <p className="mt-2 text-xs font-semibold text-blue-800">Value re-entered the collective as: {match.downstream_contribution_types?.map(label).join(", ")}</p> : <div className="mt-3 grid gap-2 md:grid-cols-[180px_1fr_auto]"><select value={(contributionDraft[match.match_id]?.type ?? "knowledge")} onChange={(e) => setContributionDraft((current) => ({ ...current, [match.match_id]: { type: e.target.value, evidence: current[match.match_id]?.evidence ?? "" } }))} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-900">{CONTRIBUTION_TYPES.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select><input value={contributionDraft[match.match_id]?.evidence ?? ""} onChange={(e) => setContributionDraft((current) => ({ ...current, [match.match_id]: { type: current[match.match_id]?.type ?? "knowledge", evidence: e.target.value } }))} placeholder="What new value did this completed opportunity create?" className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-900" /><button type="button" onClick={() => void recordContribution(match)} disabled={busy === `contribution:${match.match_id}`} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Record contribution</button></div>}</div> : null}
                  </div>
                ))}</div>}
              </section>
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
