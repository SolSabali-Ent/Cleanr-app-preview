import type {
  EligibleNorthStarOutcome,
  NorthStarOutcomeEvidence,
} from "@/domain/northStarOutcomeEvidence";
import type { NorthStarMilestone } from "@/domain/growth";
import { isOfflinePreviewMode, supabase } from "@/lib/supabase";
import { dormantFeatureError, isSupabaseFeatureUnavailable } from "@/lib/supabaseFeature";

type EvidenceRow = {
  evidence_id: string;
  milestone_id: string;
  outcome_id: string;
  opportunity_id: string;
  opportunity_type: string;
  opportunity_title: string;
  outcome_summary: string | null;
  outcome_source_system: NorthStarOutcomeEvidence["outcomeSourceSystem"];
  occurred_at: string;
  linked_at: string;
};

type MilestoneRow = {
  id: string;
  north_star_id: string;
  description: string;
  status: NorthStarMilestone["status"];
  target_date: string | null;
  completed_at: string | null;
};

type MatchOutcomeRow = {
  status: string;
  growth_opportunities:
    | { id: string; opportunity_type: string; title: string }
    | { id: string; opportunity_type: string; title: string }[]
    | null;
  growth_opportunity_outcomes:
    | { id: string; opportunity_id: string; outcome_summary: string | null; occurred_at: string }
    | { id: string; opportunity_id: string; outcome_summary: string | null; occurred_at: string }[]
    | null;
};

function first<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function listMyNorthStarOutcomeEvidence(): Promise<NorthStarOutcomeEvidence[]> {
  if (isOfflinePreviewMode) return [];
  const { data, error } = await supabase.rpc("list_my_north_star_milestone_outcome_evidence");
  if (isSupabaseFeatureUnavailable(error)) return [];
  if (error) throw error;
  return ((data ?? []) as EvidenceRow[]).map((row) => ({
    evidenceId: row.evidence_id,
    milestoneId: row.milestone_id,
    outcomeId: row.outcome_id,
    opportunityId: row.opportunity_id,
    opportunityType: row.opportunity_type,
    opportunityTitle: row.opportunity_title,
    outcomeSummary: row.outcome_summary,
    outcomeSourceSystem: row.outcome_source_system,
    occurredAt: row.occurred_at,
    linkedAt: row.linked_at,
  }));
}

export async function listMyEligibleNorthStarOutcomes(): Promise<EligibleNorthStarOutcome[]> {
  if (isOfflinePreviewMode) return [];
  const { data, error } = await supabase
    .from("opportunity_matches")
    .select("status, growth_opportunities(id, opportunity_type, title), growth_opportunity_outcomes(id, opportunity_id, outcome_summary, occurred_at)")
    .eq("status", "completed")
    .order("updated_at", { ascending: false });
  if (isSupabaseFeatureUnavailable(error)) return [];
  if (error) throw error;

  return ((data ?? []) as unknown as MatchOutcomeRow[]).flatMap((row) => {
    const opportunity = first(row.growth_opportunities);
    const outcome = first(row.growth_opportunity_outcomes);
    if (!opportunity || !outcome || opportunity.opportunity_type === "service") return [];
    return [{
      outcomeId: outcome.id,
      opportunityId: outcome.opportunity_id,
      opportunityType: opportunity.opportunity_type,
      opportunityTitle: opportunity.title,
      outcomeSummary: outcome.outcome_summary,
      occurredAt: outcome.occurred_at,
    }];
  });
}

export async function completeMyMilestoneFromOutcome(
  milestoneId: string,
  outcomeId: string
): Promise<NorthStarMilestone> {
  if (isOfflinePreviewMode) throw new Error("Outcome-backed milestone progress is unavailable in offline preview mode.");
  const { data, error } = await supabase.rpc("complete_my_north_star_milestone_from_outcome", {
    p_milestone_id: milestoneId,
    p_outcome_id: outcomeId,
  });
  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Outcome-backed milestone progress");
  if (error) throw error;
  const row = data as MilestoneRow;
  return {
    id: row.id,
    northStarId: row.north_star_id,
    description: row.description,
    status: row.status,
    targetDate: row.target_date,
    completedAt: row.completed_at,
  };
}
