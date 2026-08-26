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

export interface PersonCapability {
  id: string;
  personId: string;
  capabilityKey: string;
  label: string;
  source: "self" | "cleanr" | "verified" | "network";
  status: "developing" | "active" | "verified";
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

export interface GrowthOpportunity {
  id: string;
  type: GrowthOpportunityType;
  title: string;
  description?: string | null;
  northStarAlignment?: string | null;
  status: "open" | "matched" | "closed";
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

export interface Contribution {
  id: string;
  personId: string;
  type: ContributionType;
  beneficiaryPersonId?: string | null;
  createdAt: string;
}
