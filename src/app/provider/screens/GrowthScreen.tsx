import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Compass, Lightbulb, Network, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { NorthStar, NorthStarCategory } from "@/domain/growth";
import { buildServicePracticeSnapshot, type ServicePracticeSnapshot } from "@/domain/servicePractice";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
import { listProviderEarningsBookings } from "@/lib/bookingApi";
import { isOfflinePreviewMode } from "@/lib/supabase";
import {
  getMyNorthStar,
  listMyCapabilities,
  listMyContributions,
  listMyNorthStarMilestones,
  listMyOpportunityMatches,
  setMyNorthStar,
} from "@/lib/growthApi";
import {
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SURFACE,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

const northStarOptions: Array<{ value: NorthStarCategory; label: string }> = [
  { value: "cleaning_practice", label: "Build a strong cleaning practice" },
  { value: "stability", label: "Create more financial stability" },
  { value: "homeownership", label: "Buy a home" },
  { value: "education", label: "Continue my education" },
  { value: "entrepreneurship", label: "Build a business" },
  { value: "career_transition", label: "Move into another career" },
  { value: "investing", label: "Build through investing" },
  { value: "family_time", label: "Create more time for family or life" },
  { value: "retirement_from_physical_cleaning", label: "Reduce or retire from physical cleaning" },
  { value: "other", label: "Something else" },
];

const emptyServicePractice: ServicePracticeSnapshot = {
  confirmedServicesCount: 0,
  confirmedHouseholdsCount: 0,
  repeatHouseholdsCount: 0,
  repeatServicesCount: 0,
  scheduledServicesCount: 0,
  returningHouseholdsScheduledCount: 0,
};

function categoryLabel(category: NorthStarCategory): string {
  return northStarOptions.find((option) => option.value === category)?.label ?? "Personal North Star";
}

export default function GrowthScreen() {
  const navigate = useNavigate();
  const [northStar, setNorthStar] = useState<NorthStar | null>(null);
  const [category, setCategory] = useState<NorthStarCategory>("cleaning_practice");
  const [goal, setGoal] = useState("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(!isOfflinePreviewMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [milestoneCount, setMilestoneCount] = useState(0);
  const [capabilityCount, setCapabilityCount] = useState(0);
  const [matchedOpportunityCount, setMatchedOpportunityCount] = useState(0);
  const [contributionCount, setContributionCount] = useState(0);
  const [servicePractice, setServicePractice] = useState<ServicePracticeSnapshot>(emptyServicePractice);

  useEffect(() => {
    if (isOfflinePreviewMode) {
      setLoading(false);
      return;
    }

    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const current = await getMyNorthStar();
        if (!active) return;
        setNorthStar(current);

        const [capabilities, matches, contributions, serviceRows] = await Promise.all([
          listMyCapabilities(),
          listMyOpportunityMatches(),
          listMyContributions(),
          listProviderEarningsBookings(),
        ]);
        if (!active) return;
        setCapabilityCount(capabilities.length);
        setMatchedOpportunityCount(matches.length);
        setContributionCount(contributions.length);
        setServicePractice(
          buildServicePracticeSnapshot(
            serviceRows.map((row) => ({
              status: row.status,
              customerId: row.customer_id,
              scheduledStart: row.scheduled_start,
            }))
          )
        );

        if (current) {
          const milestones = await listMyNorthStarMilestones(current.id);
          if (!active) return;
          setMilestoneCount(milestones.length);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load your growth profile");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!northStar) return;
    setCategory(northStar.category);
    setGoal(northStar.goal);
  }, [northStar?.id]);

  const canSave = useMemo(
    () => !isOfflinePreviewMode && goal.trim().length >= 3 && !saving,
    [goal, saving]
  );

  async function handleSaveNorthStar() {
    if (!canSave) return;
    try {
      setSaving(true);
      setError(null);
      const saved = await setMyNorthStar(goal.trim(), category);
      setNorthStar(saved);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your North Star");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <Sparkles size={14} style={{ color: CSP_PRIMARY_BUTTON }} />
          <span style={{ color: CSP_TEXT_SECONDARY }}>Your growth inside Cleanr</span>
        </div>
        <h1 className="text-2xl font-semibold">Your North Star</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          Cleaning can be a strong practice, a source of stability, or the beginning of something else. You decide what you&apos;re building toward.
        </p>
      </header>

      {error ? <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(248,113,113,.25)", backgroundColor: "rgba(248,113,113,.08)" }}>{error}</div> : null}

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}20` }}><Compass size={20} style={{ color: CSP_PRIMARY_BUTTON }} /></div>
            <div>
              <p className="text-sm font-medium">{northStar && !editing ? categoryLabel(northStar.category) : "What are you building toward?"}</p>
              <p className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Your answer belongs to you.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading your North Star...</p>
          ) : northStar && !editing ? (
            <>
              <p className="text-lg font-semibold leading-7">{northStar.goal}</p>
              <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>This is your current direction, not a requirement. You can change it as your life changes.</p>
              <button type="button" onClick={() => setEditing(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold">Update my North Star <ArrowRight size={16} /></button>
            </>
          ) : isOfflinePreviewMode ? (
            <>
              <p className="text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>A North Star can be a thriving cleaning practice, homeownership, education, a business, another career, investing, more family time, or something Cleanr never predicted.</p>
              <button type="button" disabled className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold opacity-70">Define my North Star <ArrowRight size={16} /></button>
            </>
          ) : (
            <div className="space-y-3">
              <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Direction</span><select value={category} onChange={(event) => setCategory(event.target.value as NorthStarCategory)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none">{northStarOptions.map((option) => <option key={option.value} value={option.value} className="text-black">{option.label}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>In your words</span><textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} maxLength={500} placeholder="What are you trying to build or make possible?" className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none" /></label>
              <button type="button" disabled={!canSave} onClick={() => void handleSaveNorthStar()} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>{saving ? "Saving..." : northStar ? "Save changes" : "Set my North Star"}{!saving ? <ArrowRight size={16} /> : null}</button>
              {northStar ? <button type="button" onClick={() => { setEditing(false); setCategory(northStar.category); setGoal(northStar.goal); }} className="w-full py-2 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Cancel</button> : null}
            </div>
          )}
        </div>
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="rounded-2xl border" style={{ backgroundColor: "rgba(141,204,100,.08)", borderColor: "rgba(141,204,100,.22)", padding: CSP_CARD_PADDING }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Capacity stays yours to declare.</p>
              {isOfflinePreviewMode ? (
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  Repeat service can create stability, but Cleanr does not treat income, repeat households, or a busy calendar as permission to decide what you should do next.
                </p>
              ) : (
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  Your current service history includes {servicePractice.repeatHouseholdsCount} repeat household{servicePractice.repeatHouseholdsCount === 1 ? "" : "s"} and {servicePractice.returningHouseholdsScheduledCount} returning household{servicePractice.returningHouseholdsScheduledCount === 1 ? "" : "s"} already scheduled. Those are signs of continuity, not instructions about your future.
                </p>
              )}
            </div>
            <Compass size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
          </div>
          <p className="mt-3 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
            If you want Cleanr to consider paths beyond Jobs, you choose whether matching is on, what kinds of opportunities interest you, and what time or location constraints actually fit your life. Kinex can use that explicit durable truth for decisioning; Cleanr does not infer your North Star from earnings.
          </p>
          <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.fit)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold">
            Set what fits my life <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Your growth system</h2>
        <div className="space-y-3">
          <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.milestones)} className="w-full rounded-2xl border text-left" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}><div className="flex items-start gap-3"><Sparkles size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} /><div className="flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Milestones</p><span className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{isOfflinePreviewMode ? "Open" : milestoneCount}</span></div><p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Break your North Star into progress you can actually see.</p></div><ArrowRight size={16} style={{ color: CSP_TEXT_SECONDARY }} /></div></button>
          <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.capabilities)} className="w-full rounded-2xl border text-left" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}><div className="flex items-start gap-3"><Lightbulb size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} /><div className="flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Capabilities</p><span className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{isOfflinePreviewMode ? "Open" : capabilityCount}</span></div><p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Track what you can do beyond a cleaner-only identity, with clear provenance for self-declared and verified strengths.</p></div><ArrowRight size={16} style={{ color: CSP_TEXT_SECONDARY }} /></div></button>
          <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.opportunities)} className="w-full rounded-2xl border text-left" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}><div className="flex items-start gap-3"><Compass size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} /><div className="flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Opportunities</p><span className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{isOfflinePreviewMode ? "Open" : matchedOpportunityCount}</span></div><p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Jobs stay in Jobs. This is where useful paths beyond a cleaning assignment can surface—coverage, referrals, training, leadership, business, vendor, education, external, investment, or something the network makes possible later.</p></div><ArrowRight size={16} style={{ color: CSP_TEXT_SECONDARY }} /></div></button>
          <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.network)} className="w-full rounded-2xl border text-left" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}><div className="flex items-start gap-3"><Users size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} /><div className="flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Your Network</p><span className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Open</span></div><p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Households, trusted coverage, peers, collaborators, and useful introductions when you want them—purposeful relationships, not a social feed.</p></div><ArrowRight size={16} style={{ color: CSP_TEXT_SECONDARY }} /></div></button>
          <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.contributions)} className="w-full rounded-2xl border text-left" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}><div className="flex items-start gap-3"><Network size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} /><div className="flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Contribution</p><span className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{isOfflinePreviewMode ? "Open" : contributionCount}</span></div><p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>See durable evidence of value you helped create for another person or the collective. No points, no self-awarded badges.</p></div><ArrowRight size={16} style={{ color: CSP_TEXT_SECONDARY }} /></div></button>
        </div>
      </section>

      <section><div className="rounded-2xl border" style={{ backgroundColor: "rgba(141,204,100,.08)", borderColor: "rgba(141,204,100,.22)", padding: CSP_CARD_PADDING }}><p className="text-sm font-medium">Cleanr grows when you gain more choices.</p><p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>A profitable cleaning practice may be your destination. It may also be the economic engine that helps you reach something else. Cleanr is designed to support either path.</p></div></section>
    </div>
  );
}
