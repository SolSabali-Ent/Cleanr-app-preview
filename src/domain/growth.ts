/**
 * CSP growth domain primitives.
 *
 * These types intentionally sit beside the residential service engine rather than
 * replacing provider/job concepts. They describe a person's direction, capabilities,
 * opportunities, and contributions so Cleanr can evolve beyond cleaner-only identity.
 */

export type NorthStarCategory =
  | "cleaning_practice"
  | "stability"
  | "homeownership"
  | "education"
  | "entrepreneurship"
  | "career_transition"
  | "investing"
  | "family_time"
  | "retirement_from_physical_cleaning"
  | "other";

export type NorthStarStatus = "active" | "paused" | "reached";

export interface NorthStar {
  id: string;
  personId: string;
  goal: string;
  category: NorthStarCategory;
  currentStage?: string | null;
  status: NorthStarStatus;
  createdAt: string;
  updatedAt: string;
}

export type NorthStarMilestoneStatus = "not_started" | "in_progress" | "completed";

export interface NorthStarMilestone {
  id: string;
  northStarId: string;
  description: string;
  status: NorthStarMilestoneStatus;
  targetDate?: string | null;
  completedAt?: string | null;
}

export type CapabilitySource = "self" | "cleanr" | "verified" | "network";
export type CapabilityStatus = "developing" | "active" | "verified";

export interface PersonCapability {
  id: string;
  personId: string;
  capabilityKey: string;
  label: string;
  source: CapabilitySource;
  status: CapabilityStatus;
}

export type GrowthOpportunityType =
  | "service"
  | "backup_coverage"
  | "referral"
  | "mentorship"
  | "training"
  | "leadership"
  | "business"
  | "vendor"
  | "education"
  | "external"
  | "investment";

export type GrowthOpportunityVisibility = "network" | "matched_only";

export interface GrowthOpportunity {
  id: string;
  type: GrowthOpportunityType;
  title: string;
  description?: string | null;
  geographicScope?: string | null;
  startsAt?: string | null;
  closesAt?: string | null;
  visibility?: GrowthOpportunityVisibility;
  status: "open" | "matched" | "closed";
}

export type OpportunityTimePreference = "light" | "weekly" | "flexible";
export type OpportunityLocationPreference = "local" | "remote" | "either";

export interface OpportunityFitPreferences {
  personId: string;
  matchingEnabled: boolean;
  introductionsEnabled: boolean;
  opportunityTypes: Exclude<GrowthOpportunityType, "service">[];
  timePreference?: OpportunityTimePreference | null;
  locationPreference?: OpportunityLocationPreference | null;
  travelRadiusMiles?: number | null;
  fitNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A match is durable Cleanr product truth, but the decision to create a match belongs
 * to Kinex/admin/system orchestration. Cleanr stores the result and the person's response.
 * "offered" is also orchestration-owned: a person can express interest but cannot self-offer.
 */
export type OpportunityMatchStatus =
  | "suggested"
  | "viewed"
  | "interested"
  | "offered"
  | "accepted"
  | "declined"
  | "completed";

export type OpportunityMatchSource = "kinex" | "admin" | "system";
export type OpportunityOutcomeSource = "kinex" | "admin" | "system";

/**
 * An outcome is verified evidence that the accepted opportunity actually happened.
 * It is not a Contribution. Personal progress can be real without implying that value
 * was created for another person or the collective.
 */
export interface OpportunityOutcome {
  id: string;
  matchId: string;
  opportunityId: string;
  personId: string;
  summary?: string | null;
  sourceSystem: OpportunityOutcomeSource;
  occurredAt: string;
  createdAt: string;
}

export interface OpportunityMatch {
  id: string;
  opportunityId: string;
  personId: string;
  opportunity: GrowthOpportunity;
  matchReason?: string | null;
  northStarAlignment?: string | null;
  capabilityAlignment?: string | null;
  interestAlignment?: string | null;
  constraintFit?: string | null;
  matchSource: OpportunityMatchSource;
  status: OpportunityMatchStatus;
  offeredAt?: string | null;
  matchedAt: string;
  createdAt: string;
  updatedAt: string;
  outcome?: OpportunityOutcome | null;
}

export type ContributionType =
  | "customer_referral"
  | "csp_referral"
  | "backup_coverage"
  | "mentorship"
  | "trust_handoff"
  | "knowledge"
  | "opportunity_created"
  | "employment_created"
  | "business_created"
  | "capital"
  | "leadership";

export type ContributionSourceSystem = "cleanr" | "kinex" | "admin" | "import";

/**
 * Contributions are evidence of value created for another person or the network.
 * They are provenance records, not points and not self-awarded rewards.
 */
export interface Contribution {
  id: string;
  personId: string;
  type: ContributionType;
  beneficiaryPersonId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceSystem: ContributionSourceSystem;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}
