import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Compass, Link2, MapPin, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type {
  GrowthOpportunity,
  GrowthOpportunityType,
  NorthStarMilestone,
  OpportunityFitPreferences,
  OpportunityLocationPreference,
  OpportunityMatch,
  OpportunityTimePreference,
} from "@/domain/growth";
import type { NorthStarOpportunityRelevance } from "@/domain/northStarOpportunityRelevance";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
import { isOfflinePreviewMode } from "@/lib/supabase";
import {
  getMyNorthStar,
  getMyOpportunityFitPreferences,
  listMyNorthStarMilestones,
  listMyOpportunityMatches,
  listOpenGrowthOpportunities,
  respondToMyOpportunityMatch,
  setMyOpportunityFitPreferences,
} from "@/lib/growthApi";
import {
  listMyNorthStarOpportunityRelevance,
  setMyNorthStarOpportunityRelevance,
} from "@/lib/northStarOpportunityRelevanceApi";
import {
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SURFACE,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

const typeOptions: Array<{ value: Exclude<GrowthOpportunityType, "service" | "mentorship">; label: string }> = [
  { value: "backup_coverage", label: "Backup coverage" },
  { value: "referral", label: "Referrals" },
  { value: "training", label: "Training" },
  { value: "leadership", label: "Leadership" },
  { value: "business", label: "Business building" },
  { value: "vendor", label: "Vendor opportunities" },
  { value: "education", label: "Education" },
  { value: "external", label: "External opportunities" },
  { value: "investment", label: "Investing" },
];

type OpportunityView = "for_you" | "browse" | "preferences";

function opportunityTypeLabel(type: GrowthOpportunity["type"]): string {
  return type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function matchStatusLabel(status: OpportunityMatch["status"]): string {
  if (status === "offered") return "Offer ready";
  if (status === "interested") return "Interested";
  if (status === "accepted") return "Accepted";
  if (status === "completed") return "Completed";
  if (status === "declined") return "Passed";
  return "Suggested";
}

export default function GrowthOpportunitiesScreen() {
  const navigate = useNavigate();
  const [view, setView] = useState<OpportunityView>("for_you");
  const [matches, setMatches] = useState<OpportunityMatch[]>([]);
  const [open, setOpen] = useState<GrowthOpportunity[]>([]);
  const [milestones, setMilestones] = useState<NorthStarMilestone[]>([]);
  const [relevance, setRelevance] = useState<NorthStarOpportunityRelevance[]>([]);
  const [selectedMilestoneByMatch, setSelectedMilestoneByMatch] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);

  const [matchingEnabled, setMatchingEnabled] = useState(false);
  const [introductionsEnabled, setIntroductionsEnabled] = useState(false);
  const [types, setTypes] = useState<OpportunityFitPreferences["opportunityTypes"]>([]);
  const [timePreference, setTimePreference] = useState<OpportunityTimePreference | "">("");
  const [locationPreference, setLocationPreference] = useState<OpportunityLocationPreference | "">("");
  const [travelRadiusMiles, setTravelRadiusMiles] = useState("");
  const [fitNotes, setFitNotes] = useState("");
  const [savingFit, setSavingFit] = useState(false);
  const [fitSaved, setFitSaved] = useState(false);

  async function refresh() {
    try {
      setError(null);
      const [myMatches, openOpportunities, currentNorthStar, currentRelevance] = await Promise.all([
        listMyOpportunityMatches(),
        listOpenGrowthOpportunities(),
        getMyNorthStar(),
        listMyNorthStarOpportunityRelevance(),
      ]);
      setMatches(myMatches);
      setOpen(openOpportunities);
      setRelevance(currentRelevance);
      if (currentNorthStar) {
        setMilestones((await listMyNorthStarMilestones(currentNorthStar.id)).filter((milestone) => milestone.status !== "completed"));
      } else {
        setMilestones([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load opportunities");
    }
  }

  useEffect(() => { void refresh(); }, []);

  useEffect(() => {
    if (isOfflinePreviewMode) return;
    void (async () => {
      try {
        const current = await getMyOpportunityFitPreferences();
        if (!current) return;
        setMatchingEnabled(current.matchingEnabled);
        setIntroductionsEnabled(current.introductionsEnabled);
        setTypes(current.opportunityTypes.filter((type) => type !== "mentorship"));
        setTimePreference(current.timePreference ?? "");
        setLocationPreference(current.locationPreference ?? "");
        setTravelRadiusMiles(current.travelRadiusMiles == null ? "" : String(current.travelRadiusMiles));
        setFitNotes(current.fitNotes ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load opportunity preferences");
      }
    })();
  }, []);

  const matchedOpportunityIds = useMemo(() => new Set(matches.map((match) => match.opportunityId)), [matches]);
  const discoverable = open.filter((opportunity) => !matchedOpportunityIds.has(opportunity.id));
  const activeRelevanceByMatch = useMemo(() => {
    const map = new Map<string, NorthStarOpportunityRelevance>();
    for (const item of relevance) if (item.relevanceStatus === "active") map.set(item.matchId, item);
    return map;
  }, [relevance]);
  const canSaveFit = !isOfflinePreviewMode && !savingFit;

  function markFitChanged() {
    setFitSaved(false);
  }

  function toggleType(value: Exclude<GrowthOpportunityType, "service" | "mentorship">) {
    setTypes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    markFitChanged();
  }

  async function saveFit() {
    if (!canSaveFit) return;
    try {
      setSavingFit(true);
      setFitSaved(false);
      setError(null);
      await setMyOpportunityFitPreferences({
        matchingEnabled,
        introductionsEnabled,
        opportunityTypes: types,
        timePreference: timePreference || null,
        locationPreference: locationPreference || null,
        travelRadiusMiles: travelRadiusMiles === "" ? null : Number(travelRadiusMiles),
        fitNotes,
      });
      setFitSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save opportunity preferences");
    } finally {
      setSavingFit(false);
    }
  }

  async function respond(matchId: string, status: "interested" | "accepted" | "declined") {
    if (isOfflinePreviewMode || busyMatchId) return;
    try {
      setBusyMatchId(matchId);
      setError(null);
      await respondToMyOpportunityMatch(matchId, status);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update opportunity response");
    } finally {
      setBusyMatchId(null);
    }
  }

  async function connectMilestone(matchId: string) {
    const milestoneId = selectedMilestoneByMatch[matchId];
    if (!milestoneId || isOfflinePreviewMode || busyMatchId) return;
    try {
      setBusyMatchId(matchId);
      setError(null);
      await setMyNorthStarOpportunityRelevance({ milestoneId, matchId, active: true });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect this opportunity to your milestone");
    } finally {
      setBusyMatchId(null);
    }
  }

  async function removeMilestoneLink(item: NorthStarOpportunityRelevance) {
    if (isOfflinePreviewMode || busyMatchId) return;
    try {
      setBusyMatchId(item.matchId);
      setError(null);
      await setMyNorthStarOpportunityRelevance({ milestoneId: item.milestoneId, matchId: item.matchId, active: false });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove this milestone connection");
    } finally {
      setBusyMatchId(null);
    }
  }

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.home)} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <ArrowLeft size={16} /> Growth
      </button>

      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Opportunities</h1>
        <p className="mt-1 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Find paths that fit your goals and your life.</p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <div className="mb-5 grid grid-cols-3 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {([
          ["for_you", "For you"],
          ["browse", "Browse"],
          ["preferences", "Preferences"],
        ] as Array<[OpportunityView, string]>).map(([value, label]) => {
          const active = view === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className="rounded-lg px-2 py-2 text-xs font-semibold transition"
              style={{ backgroundColor: active ? CSP_SURFACE : "transparent", color: active ? CSP_TEXT_PRIMARY : CSP_TEXT_SECONDARY }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {view === "for_you" ? (
        <section>
          {matches.length === 0 ? (
            <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
              <p className="text-sm font-medium">No matches yet.</p>
              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                {matchingEnabled ? "When something fits, it will show up here." : "Turn on matching in Preferences when you want Cleanr to look for a fit."}
              </p>
              {!matchingEnabled ? (
                <button type="button" onClick={() => setView("preferences")} className="mt-3 text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>
                  Set preferences
                </button>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map((match) => {
                const milestoneLink = activeRelevanceByMatch.get(match.id);
                const prospective = ["suggested", "viewed", "interested", "offered", "accepted"].includes(match.status);
                const fitSummary = match.matchReason || match.northStarAlignment || match.constraintFit || match.interestAlignment || match.capabilityAlignment;
                return (
                  <div key={match.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs" style={{ color: CSP_PRIMARY_BUTTON }}>{opportunityTypeLabel(match.opportunity.type)}</span>
                      <span className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{matchStatusLabel(match.status)}</span>
                    </div>
                    <h3 className="mt-2 font-semibold">{match.opportunity.title}</h3>
                    {fitSummary ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{fitSummary}</p> : null}

                    {(match.northStarAlignment || match.capabilityAlignment || match.interestAlignment || match.constraintFit) ? (
                      <details className="mt-3 border-t border-white/10 pt-3">
                        <summary className="cursor-pointer list-none text-xs font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Why this fits</summary>
                        <div className="mt-2 space-y-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                          {match.northStarAlignment ? <p><strong style={{ color: CSP_TEXT_PRIMARY }}>Goal:</strong> {match.northStarAlignment}</p> : null}
                          {match.capabilityAlignment ? <p><strong style={{ color: CSP_TEXT_PRIMARY }}>Skills:</strong> {match.capabilityAlignment}</p> : null}
                          {match.interestAlignment ? <p><strong style={{ color: CSP_TEXT_PRIMARY }}>Interests:</strong> {match.interestAlignment}</p> : null}
                          {match.constraintFit ? <p><strong style={{ color: CSP_TEXT_PRIMARY }}>Fit:</strong> {match.constraintFit}</p> : null}
                        </div>
                      </details>
                    ) : null}

                    {milestoneLink ? (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <Link2 size={14} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium">Linked to milestone</p>
                          <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{milestoneLink.milestoneDescription}</p>
                        </div>
                        {prospective && !isOfflinePreviewMode ? (
                          <button type="button" disabled={busyMatchId === match.id} onClick={() => void removeMilestoneLink(milestoneLink)} className="text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>Remove</button>
                        ) : null}
                      </div>
                    ) : prospective && milestones.length > 0 && !isOfflinePreviewMode ? (
                      <details className="mt-3 border-t border-white/10 pt-3">
                        <summary className="cursor-pointer list-none text-xs font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Connect to a milestone</summary>
                        <div className="mt-3 flex gap-2">
                          <select value={selectedMilestoneByMatch[match.id] ?? ""} onChange={(event) => setSelectedMilestoneByMatch((current) => ({ ...current, [match.id]: event.target.value }))} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                            <option value="" className="text-black">Choose milestone</option>
                            {milestones.map((milestone) => <option key={milestone.id} value={milestone.id} className="text-black">{milestone.description}</option>)}
                          </select>
                          <button type="button" disabled={!selectedMilestoneByMatch[match.id] || busyMatchId === match.id} onClick={() => void connectMilestone(match.id)} className="rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Link</button>
                        </div>
                      </details>
                    ) : null}

                    {match.status === "offered" && !isOfflinePreviewMode ? (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button type="button" disabled={busyMatchId === match.id} onClick={() => void respond(match.id, "accepted")} className="rounded-xl px-2 py-2 text-xs font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Accept offer</button>
                        <button type="button" disabled={busyMatchId === match.id} onClick={() => void respond(match.id, "declined")} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-semibold">Pass</button>
                      </div>
                    ) : !["interested", "accepted", "declined", "completed"].includes(match.status) && !isOfflinePreviewMode ? (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button type="button" disabled={busyMatchId === match.id} onClick={() => void respond(match.id, "interested")} className="rounded-xl px-2 py-2 text-xs font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Interested</button>
                        <button type="button" disabled={busyMatchId === match.id} onClick={() => void respond(match.id, "declined")} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-semibold">Pass</button>
                      </div>
                    ) : null}

                    {match.status === "interested" ? <p className="mt-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Interest shared. You&apos;re not committed yet.</p> : null}
                    {match.status === "accepted" ? <p className="mt-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Accepted. We&apos;ll keep the outcome here when it&apos;s complete.</p> : null}
                    {match.status === "completed" ? (
                      <details className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <summary className="cursor-pointer list-none text-xs font-semibold">Verified outcome</summary>
                        <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{match.outcome?.summary ?? "Completion was verified and recorded."}</p>
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {view === "browse" ? (
        <section>
          {discoverable.length === 0 ? (
            <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
              <p className="text-sm font-medium">Nothing new to browse right now.</p>
              <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>New opportunities will appear here as the network creates them.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {discoverable.map((opportunity) => (
                <div key={opportunity.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                  <div className="flex items-center gap-2 text-xs" style={{ color: CSP_PRIMARY_BUTTON }}><Compass size={14} /> {opportunityTypeLabel(opportunity.type)}</div>
                  <h3 className="mt-2 font-semibold">{opportunity.title}</h3>
                  {opportunity.description ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{opportunity.description}</p> : null}
                  {opportunity.geographicScope ? <div className="mt-3 flex items-center gap-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}><MapPin size={13} /> {opportunity.geographicScope}</div> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {view === "preferences" ? (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal size={18} style={{ color: CSP_PRIMARY_BUTTON }} />
            <div>
              <h2 className="text-sm font-semibold">Opportunity preferences</h2>
              <p className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>You control when matching and introductions are on.</p>
            </div>
          </div>

          <div className="space-y-5">
            <label className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-sm font-medium">Match me with opportunities</p>
                <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Uses your saved goal, interests, and fit preferences.</p>
              </div>
              <input type="checkbox" checked={matchingEnabled} disabled={isOfflinePreviewMode} onChange={(event) => { setMatchingEnabled(event.target.checked); markFitChanged(); }} className="h-5 w-5" />
            </label>

            <label className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="text-sm font-medium">Suggest useful introductions</p>
                <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>New person-to-person connections still require mutual consent.</p>
              </div>
              <input type="checkbox" checked={introductionsEnabled} disabled={isOfflinePreviewMode} onChange={(event) => { setIntroductionsEnabled(event.target.checked); markFitChanged(); }} className="h-5 w-5" />
            </label>

            <div>
              <p className="text-sm font-medium">I&apos;m interested in</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {typeOptions.map((option) => {
                  const active = types.includes(option.value);
                  return (
                    <button key={option.value} type="button" disabled={isOfflinePreviewMode} onClick={() => toggleType(option.value)} className="rounded-xl border px-3 py-2 text-left text-xs" style={{ borderColor: active ? CSP_PRIMARY_BUTTON : "rgba(248,250,252,.10)", backgroundColor: active ? `${CSP_PRIMARY_BUTTON}18` : "rgba(255,255,255,.03)" }}>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 border-t border-white/10 pt-4">
              <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Time</span><select value={timePreference} disabled={isOfflinePreviewMode} onChange={(event) => { setTimePreference(event.target.value as OpportunityTimePreference | ""); markFitChanged(); }} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm"><option value="" className="text-black">No preference</option><option value="light" className="text-black">Occasional</option><option value="weekly" className="text-black">Weekly is okay</option><option value="flexible" className="text-black">Flexible</option></select></label>
              <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Location</span><select value={locationPreference} disabled={isOfflinePreviewMode} onChange={(event) => { setLocationPreference(event.target.value as OpportunityLocationPreference | ""); markFitChanged(); }} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm"><option value="" className="text-black">No preference</option><option value="local" className="text-black">Local / in-person</option><option value="remote" className="text-black">Remote</option><option value="either" className="text-black">Either</option></select></label>
              <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Travel radius</span><input type="number" min={0} max={250} value={travelRadiusMiles} disabled={isOfflinePreviewMode} onChange={(event) => { setTravelRadiusMiles(event.target.value); markFitChanged(); }} placeholder="Miles" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm" /></label>
              <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Anything else?</span><textarea rows={2} maxLength={500} value={fitNotes} disabled={isOfflinePreviewMode} onChange={(event) => { setFitNotes(event.target.value); markFitChanged(); }} placeholder="Availability or other practical fit details" className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm" /></label>
            </div>

            <button type="button" disabled={!canSaveFit} onClick={() => void saveFit()} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
              {fitSaved ? <><Check size={16} /> Saved</> : savingFit ? "Saving…" : "Save preferences"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
