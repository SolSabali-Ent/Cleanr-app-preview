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
  return northStarOptions.find((option) => option.value === category)?.label ?? "Personal goal";
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
        setError(err instanceof Error ? err.message : "Unable to load Growth");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
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

  const navItems = [
    {
      label: "Milestones",
      description: "Track your progress",
      count: milestoneCount,
      icon: Sparkles,
      route: CSP_GROWTH_ROUTES.milestones,
    },
    {
      label: "Skills & strengths",
      description: "Keep track of what you can do",
      count: capabilityCount,
      icon: Lightbulb,
      route: CSP_GROWTH_ROUTES.capabilities,
    },
    {
      label: "Opportunities",
      description: "See what could be next",
      count: matchedOpportunityCount,
      icon: Compass,
      route: CSP_GROWTH_ROUTES.opportunities,
    },
    {
      label: "Your Network",
      description: "People and relationships around you",
      count: null,
      icon: Users,
      route: CSP_GROWTH_ROUTES.network,
    },
    {
      label: "What you've helped build",
      description: "See how you've helped others",
      count: contributionCount,
      icon: Network,
      route: CSP_GROWTH_ROUTES.contributions,
    },
  ];

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Growth</h1>
        <p className="mt-1 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
          Your goal, progress, and next steps.
        </p>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(248,113,113,.25)", backgroundColor: "rgba(248,113,113,.08)" }}>
          {error}
        </div>
      ) : null}

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}20` }}>
                <Compass size={20} style={{ color: CSP_PRIMARY_BUTTON }} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: CSP_TEXT_SECONDARY }}>North Star</p>
                {northStar && !editing ? (
                  <>
                    <p className="mt-1 text-lg font-semibold leading-6">{northStar.goal}</p>
                    <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{categoryLabel(northStar.category)}</p>
                  </>
                ) : !editing ? (
                  <p className="mt-1 text-sm font-medium">What are you building toward?</p>
                ) : null}
              </div>
            </div>
            {northStar && !editing ? (
              <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>
                Edit
              </button>
            ) : null}
          </div>

          {loading ? (
            <p className="mt-4 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading...</p>
          ) : editing || (!northStar && !isOfflinePreviewMode) ? (
            <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
              <label className="block">
                <span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Direction</span>
                <select value={category} onChange={(event) => setCategory(event.target.value as NorthStarCategory)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none">
                  {northStarOptions.map((option) => <option key={option.value} value={option.value} className="text-black">{option.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>In your words</span>
                <textarea value={goal} onChange={(event) => setGoal(event.target.value)} rows={3} maxLength={500} placeholder="What are you trying to make possible?" className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none" />
              </label>
              <button type="button" disabled={!canSave} onClick={() => void handleSaveNorthStar()} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
                {saving ? "Saving..." : northStar ? "Save changes" : "Set my North Star"}
              </button>
              {northStar ? (
                <button type="button" onClick={() => { setEditing(false); setCategory(northStar.category); setGoal(northStar.goal); }} className="w-full py-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                  Cancel
                </button>
              ) : null}
            </div>
          ) : !northStar && isOfflinePreviewMode ? (
            <button type="button" disabled className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold opacity-70">
              Set my North Star
            </button>
          ) : null}
        </div>
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border px-3 py-3 text-center" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            <p className="text-lg font-semibold">{isOfflinePreviewMode ? "—" : servicePractice.repeatHouseholdsCount}</p>
            <p className="mt-1 text-[10px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>Repeat homes</p>
          </div>
          <div className="rounded-xl border px-3 py-3 text-center" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            <p className="text-lg font-semibold">{isOfflinePreviewMode ? "—" : milestoneCount}</p>
            <p className="mt-1 text-[10px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>Milestones</p>
          </div>
          <div className="rounded-xl border px-3 py-3 text-center" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            <p className="text-lg font-semibold">{isOfflinePreviewMode ? "—" : matchedOpportunityCount}</p>
            <p className="mt-1 text-[10px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>Matches</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Explore</h2>
        <div className="overflow-hidden rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
          {navItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.route)}
                className={`flex w-full items-center gap-3 px-4 py-4 text-left ${index > 0 ? "border-t border-white/10" : ""}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}18` }}>
                  <Icon size={18} style={{ color: CSP_PRIMARY_BUTTON }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.count !== null && !isOfflinePreviewMode ? (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}>{item.count}</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{item.description}</p>
                </div>
                <ArrowRight size={16} className="shrink-0" style={{ color: CSP_TEXT_SECONDARY }} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
