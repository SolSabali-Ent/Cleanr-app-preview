import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Link2, Plus, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { NorthStar, NorthStarMilestone } from "@/domain/growth";
import type { EligibleNorthStarOutcome, NorthStarOutcomeEvidence } from "@/domain/northStarOutcomeEvidence";
import { isOfflinePreviewMode } from "@/lib/supabase";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
import {
  addNorthStarMilestone,
  getMyNorthStar,
  listMyNorthStarMilestones,
  setNorthStarMilestoneStatus,
} from "@/lib/growthApi";
import {
  completeMyMilestoneFromOutcome,
  listMyEligibleNorthStarOutcomes,
  listMyNorthStarOutcomeEvidence,
} from "@/lib/northStarOutcomeEvidenceApi";
import {
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SURFACE,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

function opportunityTypeLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MilestonesScreen() {
  const navigate = useNavigate();
  const [northStar, setNorthStar] = useState<NorthStar | null>(null);
  const [milestones, setMilestones] = useState<NorthStarMilestone[]>([]);
  const [eligibleOutcomes, setEligibleOutcomes] = useState<EligibleNorthStarOutcome[]>([]);
  const [evidence, setEvidence] = useState<NorthStarOutcomeEvidence[]>([]);
  const [selectedOutcomeByMilestone, setSelectedOutcomeByMilestone] = useState<Record<string, string>>({});
  const [description, setDescription] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      const current = await getMyNorthStar();
      setNorthStar(current);
      if (!current) {
        setMilestones([]);
        setEligibleOutcomes([]);
        setEvidence([]);
        return;
      }

      const [nextMilestones, nextOutcomes, nextEvidence] = await Promise.all([
        listMyNorthStarMilestones(current.id),
        listMyEligibleNorthStarOutcomes(),
        listMyNorthStarOutcomeEvidence(),
      ]);
      setMilestones(nextMilestones);
      setEligibleOutcomes(nextOutcomes);
      setEvidence(nextEvidence);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load milestones");
    }
  }

  useEffect(() => { void refresh(); }, []);

  const evidenceByMilestone = useMemo(() => {
    const map = new Map<string, NorthStarOutcomeEvidence>();
    for (const item of evidence) map.set(item.milestoneId, item);
    return map;
  }, [evidence]);

  async function addMilestone() {
    if (!northStar || isOfflinePreviewMode || description.trim().length < 2 || saving) return;
    try {
      setSaving(true);
      setError(null);
      await addNorthStarMilestone(northStar.id, description.trim());
      setDescription("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add milestone");
    } finally {
      setSaving(false);
    }
  }

  async function toggleMilestone(milestone: NorthStarMilestone) {
    if (isOfflinePreviewMode || busyId) return;
    const next = milestone.status === "completed" ? "in_progress" : "completed";
    try {
      setBusyId(milestone.id);
      setError(null);
      await setNorthStarMilestoneStatus(milestone.id, next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update milestone");
    } finally {
      setBusyId(null);
    }
  }

  async function completeFromOutcome(milestoneId: string) {
    const outcomeId = selectedOutcomeByMilestone[milestoneId];
    if (!outcomeId || isOfflinePreviewMode || busyId) return;
    try {
      setBusyId(milestoneId);
      setError(null);
      await completeMyMilestoneFromOutcome(milestoneId, outcomeId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect this verified outcome to your milestone");
    } finally {
      setBusyId(null);
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
          <span style={{ color: CSP_TEXT_SECONDARY }}>Progress you can see</span>
        </div>
        <h1 className="text-2xl font-semibold">Milestones</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          Break your North Star into meaningful steps. These are personal progress markers, not Cleanr performance requirements.
        </p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      {!northStar ? (
        <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
          <p className="text-sm font-medium">Start with your North Star.</p>
          <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
            Once you define what you&apos;re building toward, you can create milestones that make progress visible.
          </p>
        </div>
      ) : (
        <>
          <section style={{ marginBottom: CSP_SECTION_GAP }}>
            <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
              <p className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Current North Star</p>
              <p className="mt-1 text-sm font-semibold">{northStar.goal}</p>
              <div className="mt-4 flex gap-2">
                <input value={description} onChange={(event) => setDescription(event.target.value)} disabled={isOfflinePreviewMode} maxLength={300} placeholder={isOfflinePreviewMode ? "Available when backend returns" : "Add a next meaningful step"} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none disabled:opacity-60" />
                <button type="button" disabled={isOfflinePreviewMode || description.trim().length < 2 || saving} onClick={() => void addMilestone()} className="flex items-center justify-center rounded-xl px-4 text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}><Plus size={18} /></button>
              </div>
            </div>
          </section>

          {eligibleOutcomes.length > 0 ? (
            <section style={{ marginBottom: CSP_SECTION_GAP }}>
              <div className="rounded-2xl border" style={{ backgroundColor: "rgba(141,204,100,.08)", borderColor: "rgba(141,204,100,.22)", padding: CSP_CARD_PADDING }}>
                <div className="flex items-start gap-3">
                  <Link2 size={18} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
                  <div>
                    <p className="text-sm font-medium">Verified outcomes can support your progress.</p>
                    <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                      Cleanr has verified {eligibleOutcomes.length} completed Growth outcome{eligibleOutcomes.length === 1 ? "" : "s"}. Only you decide whether one actually advanced a milestone. Nothing is marked complete automatically.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Your milestones</h2>
            {milestones.length === 0 ? (
              <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                <p className="text-sm font-medium">No milestones yet.</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Choose the next step that would make your North Star feel more possible.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {milestones.map((milestone) => {
                  const complete = milestone.status === "completed";
                  const milestoneEvidence = evidenceByMilestone.get(milestone.id);
                  return (
                    <div key={milestone.id} className="w-full rounded-2xl border text-left" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                      <button type="button" disabled={isOfflinePreviewMode || busyId === milestone.id} onClick={() => void toggleMilestone(milestone)} className="w-full text-left disabled:opacity-70">
                        <div className="flex items-start gap-3">
                          {complete ? <CheckCircle2 size={20} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 1 }} /> : <Circle size={20} style={{ color: CSP_TEXT_SECONDARY, marginTop: 1 }} />}
                          <div>
                            <p className={`text-sm font-medium ${complete ? "line-through opacity-70" : ""}`}>{milestone.description}</p>
                            <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{complete ? "Completed" : milestone.status.replaceAll("_", " ")}</p>
                          </div>
                        </div>
                      </button>

                      {milestoneEvidence ? (
                        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-start gap-2">
                            <Link2 size={14} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
                            <div>
                              <p className="text-xs font-medium">Backed by a verified outcome</p>
                              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                                {opportunityTypeLabel(milestoneEvidence.opportunityType)} · {milestoneEvidence.opportunityTitle}
                              </p>
                              {milestoneEvidence.outcomeSummary ? <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{milestoneEvidence.outcomeSummary}</p> : null}
                            </div>
                          </div>
                        </div>
                      ) : !complete && eligibleOutcomes.length > 0 && !isOfflinePreviewMode ? (
                        <div className="mt-4 border-t border-white/10 pt-4">
                          <p className="text-xs font-medium">Did a verified outcome move this forward?</p>
                          <p className="mt-1 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
                            Choose only if this outcome genuinely completed the milestone. This does not turn the outcome into a Contribution or award a capability.
                          </p>
                          <div className="mt-3 flex gap-2">
                            <select value={selectedOutcomeByMilestone[milestone.id] ?? ""} onChange={(event) => setSelectedOutcomeByMilestone((current) => ({ ...current, [milestone.id]: event.target.value }))} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                              <option value="" className="text-black">Choose verified outcome</option>
                              {eligibleOutcomes.map((outcome) => <option key={outcome.outcomeId} value={outcome.outcomeId} className="text-black">{outcome.opportunityTitle}</option>)}
                            </select>
                            <button type="button" disabled={!selectedOutcomeByMilestone[milestone.id] || busyId === milestone.id} onClick={() => void completeFromOutcome(milestone.id)} className="rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Connect</button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
