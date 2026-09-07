import type { NorthStarOpportunityRelevance } from "@/domain/northStarOpportunityRelevance";
import { isOfflinePreviewMode, supabase } from "@/lib/supabase";
import { dormantFeatureError, isSupabaseFeatureUnavailable } from "@/lib/supabaseFeature";

type RelevanceRow = {
  relevance_id: string;
  milestone_id: string;
  milestone_description: string;
  milestone_status: NorthStarOpportunityRelevance["milestoneStatus"];
  match_id: string;
  match_status: string;
  opportunity_id: string;
  opportunity_type: string;
  opportunity_title: string;
  relevance_note: string | null;
  relevance_status: NorthStarOpportunityRelevance["relevanceStatus"];
  linked_at: string;
  ended_at: string | null;
  updated_at: string;
};

function mapRow(row: RelevanceRow): NorthStarOpportunityRelevance {
  return {
    relevanceId: row.relevance_id,
    milestoneId: row.milestone_id,
    milestoneDescription: row.milestone_description,
    milestoneStatus: row.milestone_status,
    matchId: row.match_id,
    matchStatus: row.match_status,
    opportunityId: row.opportunity_id,
    opportunityType: row.opportunity_type,
    opportunityTitle: row.opportunity_title,
    relevanceNote: row.relevance_note,
    relevanceStatus: row.relevance_status,
    linkedAt: row.linked_at,
    endedAt: row.ended_at,
    updatedAt: row.updated_at,
  };
}

export async function listMyNorthStarOpportunityRelevance(): Promise<NorthStarOpportunityRelevance[]> {
  if (isOfflinePreviewMode) return [];
  const { data, error } = await supabase.rpc("list_my_north_star_opportunity_relevance");
  if (isSupabaseFeatureUnavailable(error)) return [];
  if (error) throw error;
  return ((data ?? []) as RelevanceRow[]).map(mapRow);
}

export async function setMyNorthStarOpportunityRelevance(input: {
  milestoneId: string;
  matchId: string;
  active: boolean;
  relevanceNote?: string | null;
}): Promise<void> {
  if (isOfflinePreviewMode) throw new Error("North Star opportunity relevance is unavailable in offline preview mode.");
  const { error } = await supabase.rpc("set_my_north_star_opportunity_relevance", {
    p_milestone_id: input.milestoneId,
    p_match_id: input.matchId,
    p_active: input.active,
    p_relevance_note: input.relevanceNote?.trim() || null,
  });
  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("North Star opportunity relevance");
  if (error) throw error;
}
