import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, SlidersHorizontal, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type {
  GrowthOpportunityType,
  OpportunityFitPreferences,
  OpportunityLocationPreference,
  OpportunityTimePreference,
} from "@/domain/growth";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
import { isOfflinePreviewMode } from "@/lib/supabase";
import {
  getMyOpportunityFitPreferences,
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

export default function OpportunityFitScreen() {
  const navigate = useNavigate();
  const [matchingEnabled, setMatchingEnabled] = useState(false);
  const [introductionsEnabled, setIntroductionsEnabled] = useState(false);
  const [types, setTypes] = useState<OpportunityFitPreferences["opportunityTypes"]>([]);
  const [timePreference, setTimePreference] = useState<OpportunityTimePreference | "">("");
  const [locationPreference, setLocationPreference] = useState<OpportunityLocationPreference | "">("");
  const [travelRadiusMiles, setTravelRadiusMiles] = useState("");
  const [fitNotes, setFitNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const canSave = useMemo(() => !isOfflinePreviewMode && !saving, [saving]);

  function toggleType(value: Exclude<GrowthOpportunityType, "service" | "mentorship">) {
    setTypes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setSaved(false);
  }

  async function save() {
    if (!canSave) return;
    try {
      setSaving(true);
      setSaved(false);
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
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save opportunity preferences");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.opportunities)} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <ArrowLeft size={16} /> Opportunities
      </button>

      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <SlidersHorizontal size={14} style={{ color: CSP_PRIMARY_BUTTON }} />
          <span style={{ color: CSP_TEXT_SECONDARY }}>Opportunity fit</span>
        </div>
        <h1 className="text-2xl font-semibold">What fits your life?</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          Tell Cleanr what kinds of opportunities you want considered. This is voluntary and never affects cleaning marketplace access, ranking, payouts, or service opportunities.
        </p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <section className="space-y-4" style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
          <label className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Use these preferences for opportunities</p>
              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Turn this on when you want Kinex to use these Cleanr-owned preferences when deciding what opportunities may be relevant.</p>
            </div>
            <input type="checkbox" checked={matchingEnabled} disabled={isOfflinePreviewMode} onChange={(event) => { setMatchingEnabled(event.target.checked); setSaved(false); }} className="mt-1 h-5 w-5" />
          </label>
        </div>

        <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
          <div className="flex items-start gap-3">
            <Users size={18} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
            <label className="flex flex-1 items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Consider useful introductions</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  Separately choose whether Cleanr may consider introducing you to someone in the network when their experience, capability, or opportunity could be useful. You can still receive non-people opportunities with this off.
                </p>
              </div>
              <input type="checkbox" checked={introductionsEnabled} disabled={isOfflinePreviewMode} onChange={(event) => { setIntroductionsEnabled(event.target.checked); setSaved(false); }} className="mt-1 h-5 w-5" />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
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

        <div className="rounded-2xl border space-y-3" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
          <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Time fit</span><select value={timePreference} disabled={isOfflinePreviewMode} onChange={(event) => { setTimePreference(event.target.value as OpportunityTimePreference | ""); setSaved(false); }} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm"><option value="" className="text-black">No preference</option><option value="light" className="text-black">Occasional / light commitment</option><option value="weekly" className="text-black">Weekly commitment is okay</option><option value="flexible" className="text-black">Flexible</option></select></label>
          <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Location fit</span><select value={locationPreference} disabled={isOfflinePreviewMode} onChange={(event) => { setLocationPreference(event.target.value as OpportunityLocationPreference | ""); setSaved(false); }} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm"><option value="" className="text-black">No preference</option><option value="local" className="text-black">Local / in-person</option><option value="remote" className="text-black">Remote</option><option value="either" className="text-black">Either</option></select></label>
          <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Travel radius, if relevant</span><input type="number" min={0} max={250} value={travelRadiusMiles} disabled={isOfflinePreviewMode} onChange={(event) => { setTravelRadiusMiles(event.target.value); setSaved(false); }} placeholder="Miles" className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm" /></label>
          <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Anything else that affects fit?</span><textarea rows={3} maxLength={500} value={fitNotes} disabled={isOfflinePreviewMode} onChange={(event) => { setFitNotes(event.target.value); setSaved(false); }} placeholder="Keep this practical—availability or fit context, not sensitive personal details." className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm" /></label>
        </div>
      </section>

      <button type="button" disabled={!canSave} onClick={() => void save()} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
        {saved ? <><Check size={16} /> Saved</> : saving ? "Saving..." : "Save opportunity fit"}
      </button>
      {isOfflinePreviewMode ? <p className="mt-3 text-center text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Preview shows the real product surface; saving activates when Supabase is available.</p> : null}
    </div>
  );
}
