/**
 * CSP growth domain primitives.
 */
export type NorthStarCategory = "cleaning_practice" | "stability" | "homeownership" | "education" | "entrepreneurship" | "career_transition" | "investing" | "family_time" | "retirement_from_physical_cleaning" | "other";
export type NorthStarStatus = "active" | "paused" | "reached";
export interface NorthStar { id:string; personId:string; goal:string; category:NorthStarCategory; currentStage?:string|null; status:NorthStarStatus; createdAt:string; updatedAt:string; }
export type NorthStarMilestoneStatus = "not_started" | "in_progress" | "completed";
export interface NorthStarMilestone { id:string; northStarId:string; description:string; status:NorthStarMilestoneStatus; targetDate?:string|null; completedAt?:string|null; }
export type CapabilitySource = "self" | "cleanr" | "verified" | "network";
export type CapabilityStatus = "developing" | "active" | "verified";
export interface PersonCapability { id:string; personId:string; capabilityKey:string; label:string; source:CapabilitySource; status:CapabilityStatus; }
export type GrowthOpportunityType = "service" | "backup_coverage" | "referral" | "mentorship" | "training" | "leadership" | "business" | "vendor" | "education" | "external" | "investment";
export interface GrowthOpportunity { id:string; type:GrowthOpportunityType; title:string; description?:string|null; geographicScope?:string|null; startsAt?:string|null; closesAt?:string|null; status:"open"|"matched"|"closed"; }
export type OpportunityTimePreference = "light" | "weekly" | "flexible";
export type OpportunityLocationPreference = "local" | "remote" | "either";
export interface OpportunityFitPreferences { personId:string; matchingEnabled:boolean; opportunityTypes:Exclude<GrowthOpportunityType,"service">[]; timePreference?:OpportunityTimePreference|null; locationPreference?:OpportunityLocationPreference|null; travelRadiusMiles?:number|null; fitNotes?:string|null; createdAt:string; updatedAt:string; }
export type OpportunityMatchStatus = "suggested" | "viewed" | "interested" | "accepted" | "declined" | "completed";
export type OpportunityMatchSource = "kinex" | "admin" | "system";
export interface OpportunityMatch { id:string; opportunityId:string; personId:string; opportunity:GrowthOpportunity; matchReason?:string|null; northStarAlignment?:string|null; capabilityAlignment?:string|null; interestAlignment?:string|null; constraintFit?:string|null; matchSource:OpportunityMatchSource; status:OpportunityMatchStatus; matchedAt:string; createdAt:string; updatedAt:string; }
export type ContributionType = "customer_referral" | "csp_referral" | "backup_coverage" | "mentorship" | "trust_handoff" | "knowledge" | "opportunity_created" | "employment_created" | "business_created" | "capital" | "leadership";
export type ContributionSourceSystem = "cleanr" | "kinex" | "admin" | "import";
export interface Contribution { id:string; personId:string; type:ContributionType; beneficiaryPersonId?:string|null; sourceType?:string|null; sourceId?:string|null; sourceSystem:ContributionSourceSystem; metadata:Record<string,unknown>; occurredAt:string; createdAt:string; }
