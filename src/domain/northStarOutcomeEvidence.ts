export interface NorthStarOutcomeEvidence {
  evidenceId: string;
  milestoneId: string;
  outcomeId: string;
  opportunityId: string;
  opportunityType: string;
  opportunityTitle: string;
  outcomeSummary?: string | null;
  outcomeSourceSystem: "kinex" | "admin" | "system";
  occurredAt: string;
  linkedAt: string;
}

export interface EligibleNorthStarOutcome {
  outcomeId: string;
  opportunityId: string;
  opportunityType: string;
  opportunityTitle: string;
  outcomeSummary?: string | null;
  occurredAt: string;
}
