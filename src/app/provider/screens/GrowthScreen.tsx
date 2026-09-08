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

  const customGoal = goal.trim();
  const canSave = useMemo(
    () => !isOfflinePreviewMode && !saving && (category !== "other" || customGoal.length >= 3),
    [category, customGoal, saving]
  );

  async function handleSaveNorthStar() {
    if (!canSave) return;
    try {
      setSaving(true);
      setError(null);
      const resolvedGoal = customGoal || categoryLabel(category);
      const saved = await setMyNorthStar(resolvedGoal, category);
      setNorthStar(saved);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save your North Star");
    } finally {
      setSaving(false);
    }
  }

  const showProgress =
    !isOfflinePreviewMode &&
    (servicePractice.repeatHouseholdsCount > 0 || milestoneCount > 0 || matchedOpportunityCount > 0);

  const navItems = [
    {
      label: "Milestones",
      description: "Break your goal into steps",
      count: milestoneCount,
      icon: Sparkles,
      route: CSP_GROWTH_ROUTES.milestones,
    },
    {
      label: "Skills & strengths",
      description: "Record what you can do",
      count: capabilityCount,
      icon: Lightbulb,
      route: CSP_GROWTH_ROUTES.capabilities,
    },
    {
      label: "Opportunities",
      description: "See relevant paths",
      count: matchedOpportunityCount,
      icon: Compass,
      route: CSP_GROWTH_ROUTES.opportunities,
    },
    {
      label: "Network",
      description: "Households, coverage, and connections",
      count: null,
      icon: Users,
      route: CSP_GROWTH_ROUTES.network,
    },
    {
      label: "Impact",
      description: "See what your work has helped create",
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
          Choose your direction. Keep moving it forward.
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
            <div className="min-w-0">
              <p className="text-xs font-medium" style={{ color: CSP_TEXT_SECONDARY }}>North Star</p>
              {northStar && !editing ? (
                <>
                  <p className="mt-1 text-lg font-semibold leading-6">{northStar.goal}</p>
                  {northStar.goal !== categoryLabel(northStar.category) ? (
                    <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{categoryLabel(northStar.category)}</p>
                  ) : null}
                </>
              ) : !editing ? (
                <p className="mt-1 text-sm font-medium">Choose what you&apos;re building toward.</p>
              ) : null}
            </div>
            {northStar && !editing ? (
              <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>
                Edit
              </button>
            ) : null}
          </div>

          {loading ? (
            <p className="mt-4 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading…</p>
          ) : editing || (!northStar && !isOfflinePreviewMode) ? (
            <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
              <label className="block">
                <span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Direction</span>
                <select value={category} onChange={(event) => setCategory(event.target.value as NorthStarCategory)} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none">
                  {northStarOptions.map((option) => <option key={option.value} value={option.value} className="text-black">{option.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                  {category === "other" ? "Describe it" : "Make it yours (optional)"}
                </span>
                <textarea
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder={category === "other" ? "What are you building toward?" : "Add your own wording if you want"}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none"
                />
              </label>
              <button type="button" disabled={!canSave} onClick={() => void handleSaveNorthStar()} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
                {saving ? "Saving…" : northStar ? "Save changes" : "Set North Star"}
              </button>
              {northStar ? (
                <button type="button" onClick={() => { setEditing(false); setCategory(northStar.category); setGoal(northStar.goal); }} className="w-full py-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                  Cancel
                </button>
              ) : null}
            </div>
          ) : !northStar && isOfflinePreviewMode ? (
            <button type="button" disabled className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold opacity-70">
              Set North Star
            </button>
          ) : null}
        </div>
      </section>

      {showProgress ? (
        <section style={{ marginBottom: CSP_SECTION_GAP }}>
          <div className="flex items-center justify-between gap-3 border-y border-white/10 py-3 text-center">
            <div className="flex-1">
              <p className="text-base font-semibold">{servicePractice.repeatHouseholdsCount}</p>
              <p className="mt-0.5 text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}>Repeat homes</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex-1">
              <p className="text-base font-semibold">{milestoneCount}</p>
              <p className="mt-0.5 text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}>Milestones</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div className="flex-1">
              <p className="text-base font-semibold">{matchedOpportunityCount}</p>
              <p className="mt-0.5 text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}>Matches</p>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Next</h2>
        <div className="overflow-hidden border-y border-white/10">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.route)}
                className={`flex w-full items-center gap-3 py-4 text-left ${index > 0 ? "border-t border-white/10" : ""}`}
              >
                <Icon size={18} className="shrink-0" style={{ color: CSP_PRIMARY_BUTTON }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.count !== null && item.count > 0 && !isOfflinePreviewMode ? (
                      <span className="text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}>{item.count}</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{item.description}</p>
                </div>
                <ArrowRight size={15} className="shrink-0" style={{ color: CSP_TEXT_SECONDARY }} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
