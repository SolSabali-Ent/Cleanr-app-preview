export type NorthStarOpportunityRelevanceStatus = "active" | "ended";

export interface NorthStarOpportunityRelevance {
  relevanceId: string;
  milestoneId: string;
  milestoneDescription: string;
  milestoneStatus: "not_started" | "in_progress" | "completed";
  matchId: string;
  matchStatus: string;
  opportunityId: string;
  opportunityType: string;
  opportunityTitle: string;
  relevanceNote?: string | null;
  relevanceStatus: NorthStarOpportunityRelevanceStatus;
  linkedAt: string;
  endedAt?: string | null;
  updatedAt: string;
}
