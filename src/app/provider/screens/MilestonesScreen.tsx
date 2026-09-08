import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Link2, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { NorthStar, NorthStarMilestone } from "@/domain/growth";
import type { EligibleNorthStarOutcome, NorthStarOutcomeEvidence } from "@/domain/northStarOutcomeEvidence";
import type { NorthStarOpportunityRelevance } from "@/domain/northStarOpportunityRelevance";
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
import { listMyNorthStarOpportunityRelevance } from "@/lib/northStarOpportunityRelevanceApi";
import {
  CSP_PRIMARY_BUTTON,
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
  const [opportunityRelevance, setOpportunityRelevance] = useState<NorthStarOpportunityRelevance[]>([]);
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
        setOpportunityRelevance([]);
        return;
      }

      const [nextMilestones, nextOutcomes, nextEvidence, nextRelevance] = await Promise.all([
        listMyNorthStarMilestones(current.id),
        listMyEligibleNorthStarOutcomes(),
        listMyNorthStarOutcomeEvidence(),
        listMyNorthStarOpportunityRelevance(),
      ]);
      setMilestones(nextMilestones);
      setEligibleOutcomes(nextOutcomes);
      setEvidence(nextEvidence);
      setOpportunityRelevance(nextRelevance);
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

  const relevanceByMilestone = useMemo(() => {
    const map = new Map<string, NorthStarOpportunityRelevance>();
    for (const item of opportunityRelevance) if (item.relevanceStatus === "active") map.set(item.milestoneId, item);
    return map;
  }, [opportunityRelevance]);

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
      setError(err instanceof Error ? err.message : "Unable to connect this outcome");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.home)} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <ArrowLeft size={16} /> Growth
      </button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Milestones</h1>
        <p className="mt-1 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Turn your North Star into next steps.</p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      {!northStar ? (
        <div className="border-y border-white/10 py-5">
          <p className="text-sm font-medium">Set your North Star first.</p>
          <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.home)} className="mt-3 text-sm font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>
            Go to Growth
          </button>
        </div>
      ) : (
        <>
          <section className="mb-7">
            <p className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>North Star</p>
            <p className="mt-1 text-sm font-semibold">{northStar.goal}</p>
            <div className="mt-4 flex gap-2">
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isOfflinePreviewMode}
                maxLength={300}
                placeholder={isOfflinePreviewMode ? "Available when backend returns" : "Add a next step"}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none disabled:opacity-60"
              />
              <button
                type="button"
                aria-label="Add milestone"
                disabled={isOfflinePreviewMode || description.trim().length < 2 || saving}
                onClick={() => void addMilestone()}
                className="flex min-h-12 min-w-12 items-center justify-center rounded-xl text-white disabled:opacity-50"
                style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
              >
                <Plus size={18} />
              </button>
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Your milestones</h2>
            {milestones.length === 0 ? (
              <div className="border-y border-white/10 py-5">
                <p className="text-sm font-medium">No milestones yet.</p>
                <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Add the next step that matters most.</p>
              </div>
            ) : (
              <div className="border-y border-white/10">
                {milestones.map((milestone, index) => {
                  const complete = milestone.status === "completed";
                  const milestoneEvidence = evidenceByMilestone.get(milestone.id);
                  const prospectiveRelevance = relevanceByMilestone.get(milestone.id);
                  return (
                    <div key={milestone.id} className={`py-4 ${index > 0 ? "border-t border-white/10" : ""}`}>
                      <button type="button" disabled={isOfflinePreviewMode || busyId === milestone.id} onClick={() => void toggleMilestone(milestone)} className="flex w-full items-start gap-3 text-left disabled:opacity-70">
                        {complete ? <CheckCircle2 size={20} className="mt-0.5 shrink-0" style={{ color: CSP_PRIMARY_BUTTON }} /> : <Circle size={20} className="mt-0.5 shrink-0" style={{ color: CSP_TEXT_SECONDARY }} />}
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${complete ? "line-through opacity-70" : ""}`}>{milestone.description}</p>
                          <p className="mt-1 text-xs capitalize" style={{ color: CSP_TEXT_SECONDARY }}>{complete ? "Completed" : milestone.status.replaceAll("_", " ")}</p>
                        </div>
                      </button>

                      {prospectiveRelevance ? (
                        <p className="ml-8 mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                          <Link2 size={12} className="mr-1 inline" style={{ color: CSP_PRIMARY_BUTTON }} />
                          May be helped by {opportunityTypeLabel(prospectiveRelevance.opportunityType)} · {prospectiveRelevance.opportunityTitle}
                        </p>
                      ) : null}

                      {milestoneEvidence ? (
                        <p className="ml-8 mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                          <CheckCircle2 size={12} className="mr-1 inline" style={{ color: CSP_PRIMARY_BUTTON }} />
                          Verified by {milestoneEvidence.opportunityTitle}
                        </p>
                      ) : !complete && eligibleOutcomes.length > 0 && !isOfflinePreviewMode ? (
                        <details className="ml-8 mt-2">
                          <summary className="cursor-pointer list-none text-xs font-medium" style={{ color: CSP_PRIMARY_BUTTON }}>
                            Connect a verified outcome
                          </summary>
                          <div className="mt-2 flex gap-2">
                            <select
                              value={selectedOutcomeByMilestone[milestone.id] ?? ""}
                              onChange={(event) => setSelectedOutcomeByMilestone((current) => ({ ...current, [milestone.id]: event.target.value }))}
                              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs"
                            >
                              <option value="" className="text-black">Choose outcome</option>
                              {eligibleOutcomes.map((outcome) => <option key={outcome.outcomeId} value={outcome.outcomeId} className="text-black">{outcome.opportunityTitle}</option>)}
                            </select>
                            <button
                              type="button"
                              disabled={!selectedOutcomeByMilestone[milestone.id] || busyId === milestone.id}
                              onClick={() => void completeFromOutcome(milestone.id)}
                              className="rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                              style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
                            >
                              Connect
                            </button>
                          </div>
                        </details>
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
