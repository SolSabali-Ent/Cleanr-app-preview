import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Compass, MapPin, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type {
  GrowthOpportunity,
  GrowthOpportunityType,
  OpportunityFitPreferences,
  OpportunityLocationPreference,
  OpportunityMatch,
  OpportunityTimePreference,
} from "@/domain/growth";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
import { isOfflinePreviewMode } from "@/lib/supabase";
import {
  getMyOpportunityFitPreferences,
  listMyOpportunityMatches,
  listOpenGrowthOpportunities,
  respondToMyOpportunityMatch,
  setMyOpportunityFitPreferences,
} from "@/lib/growthApi";
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

function opportunityTypeLabel(type: GrowthOpportunity["type"]): string {
  return type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function matchStatusLabel(status: OpportunityMatch["status"]): string {
  if (status === "offered") return "Offer ready";
  if (status === "interested") return "Interest shared";
  return status.replaceAll("_", " ");
}

export default function GrowthOpportunitiesScreen() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<OpportunityMatch[]>([]);
  const [open, setOpen] = useState<GrowthOpportunity[]>([]);
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
      const [myMatches, openOpportunities] = await Promise.all([
        listMyOpportunityMatches(),
        listOpenGrowthOpportunities(),
      ]);
      setMatches(myMatches);
      setOpen(openOpportunities);
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

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.home)} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <ArrowLeft size={16} /> Growth
      </button>

      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <Sparkles size={14} style={{ color: CSP_PRIMARY_BUTTON }} />
          <span style={{ color: CSP_TEXT_SECONDARY }}>Paths beyond Jobs</span>
        </div>
        <h1 className="text-2xl font-semibold">Opportunities</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          This is the one place to choose what fits your life and see useful paths beyond a cleaning assignment. Jobs remain in Jobs.
        </p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <details className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3" style={{ padding: CSP_CARD_PADDING }}>
            <div className="flex items-start gap-3">
              <SlidersHorizontal size={18} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
              <div>
                <p className="text-sm font-medium">What fits my life</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  Control whether matching is on, what interests you, and the practical constraints Kinex may use.
                </p>
              </div>
            </div>
            <ArrowRight size={16} style={{ color: CSP_TEXT_SECONDARY }} />
          </summary>

          <div className="space-y-4 border-t border-white/10" style={{ padding: CSP_CARD_PADDING }}>
            <label className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Consider opportunities for me</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  Turn this on when you want Kinex to use these Cleanr-owned preferences when deciding what may be relevant. Turning it off never affects Jobs, ranking, payouts, or marketplace access.
                </p>
              </div>
              <input type="checkbox" checked={matchingEnabled} disabled={isOfflinePreviewMode} onChange={(event) => { setMatchingEnabled(event.target.checked); markFitChanged(); }} className="mt-1 h-5 w-5" />
            </label>

            <div className="border-t border-white/10 pt-4">
              <div className="flex items-start gap-3">
                <Users size={18} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
                <label className="flex flex-1 items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Consider useful introductions</p>
                    <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                      This is separate from opportunity matching. Turning it off stops future person suggestions; existing accepted relationships remain yours, and every new relationship still requires both people to consent.
                    </p>
                  </div>
                  <input type="checkbox" checked={introductionsEnabled} disabled={isOfflinePreviewMode} onChange={(event) => { setIntroductionsEnabled(event.target.checked); markFitChanged(); }} className="mt-1 h-5 w-5" />
                </label>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="text-sm font-medium">I&apos;m interested in</p>
              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Choose as many or as few as you want. Cleanr does not prescribe a path.</p>
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

            <div className="space-y-3 border-t border-white/10 pt-4">
              <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Time fit</span><select value={timePreference} disabled={isOfflinePreviewMode} onChange={(event) => { setTimePreference(event.target.value as OpportunityTimePreference | ""); markFitChanged(); }} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm"><option value="" className="text-black">No preference</option><option value="light" className="text-black">Occasional / light commitment</option><option value="weekly" className="text-black">Weekly commitment is okay</option><option value="flexible" className="text-black">Flexible</option></select></label>
              <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Location fit</span><select value={locationPreference} disabled={isOfflinePreviewMode} onChange={(event) => { setLocationPreference(event.target.value as OpportunityLocationPreference | ""); markFitChanged(); }} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm"><option value="" className="text-black">No preference</option><option value="local" className="text-black">Local / in-person</option><option value="remote" className="text-black">Remote</option><option value="either" className="text-black">Either</option></select></label>
              <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Travel radius, if relevant</span><input type="number" min={0} max={250} value={travelRadiusMiles} disabled={isOfflinePreviewMode} onChange={(event) => { setTravelRadiusMiles(event.target.value); markFitChanged(); }} placeholder="Miles" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm" /></label>
              <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Anything else that affects fit?</span><textarea rows={3} maxLength={500} value={fitNotes} disabled={isOfflinePreviewMode} onChange={(event) => { setFitNotes(event.target.value); markFitChanged(); }} placeholder="Keep this practical—availability or fit context, not sensitive personal details." className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm" /></label>
            </div>

            <button type="button" disabled={!canSaveFit} onClick={() => void saveFit()} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
              {fitSaved ? <><Check size={16} /> Saved</> : savingFit ? "Saving..." : "Save what fits my life"}
            </button>
            {isOfflinePreviewMode ? <p className="text-center text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Preview shows the real product surface; saving activates when Supabase is available.</p> : null}
          </div>
        </details>
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Matched for you</h2>
        {matches.length === 0 ? (
          <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
            <p className="text-sm font-medium">No matched opportunities yet.</p>
            <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
              When you opt into matching, Kinex may use durable Cleanr truth such as your North Star, capabilities, selected interests, location, and practical constraints to decide what may be relevant. Cleanr stores the resulting match.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div key={match.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs" style={{ color: CSP_PRIMARY_BUTTON }}>{opportunityTypeLabel(match.opportunity.type)}</span>
                  <span className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{matchStatusLabel(match.status)}</span>
                </div>
                <h3 className="mt-2 font-semibold">{match.opportunity.title}</h3>
                {match.northStarAlignment ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}><strong style={{ color: CSP_TEXT_PRIMARY }}>North Star:</strong> {match.northStarAlignment}</p> : null}
                {match.capabilityAlignment ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}><strong style={{ color: CSP_TEXT_PRIMARY }}>Capabilities:</strong> {match.capabilityAlignment}</p> : null}
                {match.interestAlignment ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}><strong style={{ color: CSP_TEXT_PRIMARY }}>Interests:</strong> {match.interestAlignment}</p> : null}
                {match.constraintFit ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}><strong style={{ color: CSP_TEXT_PRIMARY }}>Fit:</strong> {match.constraintFit}</p> : null}
                {match.matchReason ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Why this surfaced: {match.matchReason}</p> : null}

                {match.status === "offered" && !isOfflinePreviewMode ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" disabled={busyMatchId === match.id} onClick={() => void respond(match.id, "accepted")} className="rounded-xl px-2 py-2 text-xs font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Accept offer</button>
                    <button type="button" disabled={busyMatchId === match.id} onClick={() => void respond(match.id, "declined")} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-semibold">Pass</button>
                  </div>
                ) : !["interested","accepted","declined","completed"].includes(match.status) && !isOfflinePreviewMode ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" disabled={busyMatchId === match.id} onClick={() => void respond(match.id, "interested")} className="rounded-xl px-2 py-2 text-xs font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>I&apos;m interested</button>
                    <button type="button" disabled={busyMatchId === match.id} onClick={() => void respond(match.id, "declined")} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-semibold">Pass</button>
                  </div>
                ) : null}

                {match.status === "interested" ? (
                  <p className="mt-3 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                    Interest shared. Kinex or Cleanr operations can decide whether to offer the opportunity; you are not committed yet.
                  </p>
                ) : null}
                {match.status === "accepted" ? (
                  <p className="mt-3 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                    Accepted. Completion is recorded only after the real-world outcome is verified; accepting alone does not create a contribution or claim progress toward your North Star.
                  </p>
                ) : null}
                {match.status === "completed" ? (
                  <p className="mt-3 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                    Completed outcome recorded. If that outcome created value for another person or the collective, Cleanr may separately record the evidenced contribution.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Open in the network</h2>
        {discoverable.length === 0 ? (
          <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>No additional open opportunities right now.</p>
        ) : (
          <div className="space-y-3">
            {discoverable.map((opportunity) => (
              <div key={opportunity.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                <div className="flex items-center gap-2 text-xs" style={{ color: CSP_PRIMARY_BUTTON }}><Compass size={14} /> {opportunityTypeLabel(opportunity.type)}</div>
                <h3 className="mt-2 font-semibold">{opportunity.title}</h3>
                {opportunity.description ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{opportunity.description}</p> : null}
                {opportunity.geographicScope ? <div className="mt-3 flex items-center gap-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}><MapPin size={13} /> {opportunity.geographicScope}</div> : null}
                <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: CSP_TEXT_SECONDARY }}><span>Visible to the network; matching and offers still follow your saved preferences and consent.</span><ArrowRight size={13} /></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
