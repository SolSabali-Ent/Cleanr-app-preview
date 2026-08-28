import { isOfflinePreviewMode, supabase } from "@/lib/supabase";
import { dormantFeatureError, isSupabaseFeatureUnavailable } from "@/lib/supabaseFeature";
import type {
  Contribution,
  ContributionCirculation,
  GrowthOpportunity,
  NorthStar,
  NorthStarCategory,
  NorthStarMilestone,
  OpportunityFitPreferences,
  OpportunityLocationPreference,
  OpportunityMatch,
  OpportunityMatchStatus,
  OpportunityOutcome,
  OpportunityTimePreference,
  PersonCapability,
} from "@/domain/growth";

type NorthStarRow = { id: string; person_id: string; goal: string; category: NorthStarCategory; current_stage: string | null; status: NorthStar["status"]; created_at: string; updated_at: string; };
type MilestoneRow = { id: string; north_star_id: string; description: string; status: NorthStarMilestone["status"]; target_date: string | null; completed_at: string | null; };
type CapabilityRow = { id: string; person_id: string; capability_key: string; label: string; source: PersonCapability["source"]; status: PersonCapability["status"]; };
type OpportunityRow = { id: string; opportunity_type: GrowthOpportunity["type"]; title: string; description: string | null; status: "draft" | "open" | "closed"; visibility: NonNullable<GrowthOpportunity["visibility"]>; geographic_scope: string | null; starts_at: string | null; closes_at: string | null; };
type OpportunityPreferenceRow = { person_id: string; matching_enabled: boolean; introductions_enabled: boolean; opportunity_types: OpportunityFitPreferences["opportunityTypes"]; time_preference: OpportunityTimePreference | null; location_preference: OpportunityLocationPreference | null; travel_radius_miles: number | null; fit_notes: string | null; created_at: string; updated_at: string; };
type OpportunityOutcomeRow = { id: string; match_id: string; opportunity_id: string; person_id: string; outcome_summary: string | null; source_system: OpportunityOutcome["sourceSystem"]; occurred_at: string; created_at: string; };
type OpportunityMatchRow = { id: string; opportunity_id: string; person_id: string; match_reason: string | null; north_star_alignment: string | null; capability_alignment: string | null; interest_alignment: string | null; constraint_fit: string | null; match_source: OpportunityMatch["matchSource"]; status: OpportunityMatch["status"]; offered_at: string | null; matched_at: string; created_at: string; updated_at: string; growth_opportunities: OpportunityRow | OpportunityRow[] | null; growth_opportunity_outcomes: OpportunityOutcomeRow | OpportunityOutcomeRow[] | null; };
type ContributionRow = { id: string; person_id: string; beneficiary_person_id: string | null; contribution_type: Contribution["type"]; source_type: string | null; source_id: string | null; source_system: Contribution["sourceSystem"]; metadata: Record<string, unknown> | null; occurred_at: string; created_at: string; };
type ContributionCirculationRow = { contribution_id: string; opportunity_id: string; opportunity_type: ContributionCirculation["opportunityType"]; opportunity_title: string; opportunity_status: string; capacity_reason: string; source_system: ContributionCirculation["sourceSystem"]; created_at: string; };

function mapNorthStar(row: NorthStarRow): NorthStar { return { id: row.id, personId: row.person_id, goal: row.goal, category: row.category, currentStage: row.current_stage, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at }; }
function mapMilestone(row: MilestoneRow): NorthStarMilestone { return { id: row.id, northStarId: row.north_star_id, description: row.description, status: row.status, targetDate: row.target_date, completedAt: row.completed_at }; }
function mapCapability(row: CapabilityRow): PersonCapability { return { id: row.id, personId: row.person_id, capabilityKey: row.capability_key, label: row.label, source: row.source, status: row.status }; }
function mapOpportunity(row: OpportunityRow): GrowthOpportunity { return { id: row.id, type: row.opportunity_type, title: row.title, description: row.description, geographicScope: row.geographic_scope, startsAt: row.starts_at, closesAt: row.closes_at, visibility: row.visibility, status: row.status === "closed" ? "closed" : "open" }; }
function mapOpportunityOutcome(row: OpportunityOutcomeRow): OpportunityOutcome { return { id: row.id, matchId: row.match_id, opportunityId: row.opportunity_id, personId: row.person_id, summary: row.outcome_summary, sourceSystem: row.source_system, occurredAt: row.occurred_at, createdAt: row.created_at }; }
function firstOpportunity(row: OpportunityMatchRow): OpportunityRow | null { const related = row.growth_opportunities; if (!related) return null; return Array.isArray(related) ? related[0] ?? null : related; }
function firstOutcome(row: OpportunityMatchRow): OpportunityOutcomeRow | null { const related = row.growth_opportunity_outcomes; if (!related) return null; return Array.isArray(related) ? related[0] ?? null : related; }
function mapOpportunityPreferences(row: OpportunityPreferenceRow): OpportunityFitPreferences { return { personId: row.person_id, matchingEnabled: row.matching_enabled, introductionsEnabled: row.introductions_enabled, opportunityTypes: row.opportunity_types ?? [], timePreference: row.time_preference, locationPreference: row.location_preference, travelRadiusMiles: row.travel_radius_miles, fitNotes: row.fit_notes, createdAt: row.created_at, updatedAt: row.updated_at }; }

export async function getMyNorthStar(): Promise<NorthStar | null> {
  if (isOfflinePreviewMode) return null;
  const { data, error } = await supabase.from("north_stars").select("id, person_id, goal, category, current_stage, status, created_at, updated_at").eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (isSupabaseFeatureUnavailable(error)) return null;
  if (error) throw error;
  return data ? mapNorthStar(data as NorthStarRow) : null;
}

export async function setMyNorthStar(goal: string, category: NorthStarCategory): Promise<NorthStar> {
  if (isOfflinePreviewMode) throw new Error("North Star persistence is unavailable in offline preview mode.");
  const { data, error } = await supabase.rpc("set_my_north_star", { p_goal: goal, p_category: category });
  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("North Star persistence");
  if (error) throw error;
  return mapNorthStar(data as NorthStarRow);
}

export async function listMyNorthStarMilestones(northStarId: string): Promise<NorthStarMilestone[]> {
  if (isOfflinePreviewMode) return [];
  const { data, error } = await supabase.from("north_star_milestones").select("id, north_star_id, description, status, target_date, completed_at").eq("north_star_id", northStarId).order("position", { ascending: true }).order("created_at", { ascending: true });
  if (isSupabaseFeatureUnavailable(error)) return [];
  if (error) throw error;
  return ((data ?? []) as MilestoneRow[]).map(mapMilestone);
}

export async function addNorthStarMilestone(northStarId: string, description: string): Promise<NorthStarMilestone> {
  if (isOfflinePreviewMode) throw new Error("Milestone persistence is unavailable in offline preview mode.");
  const { data, error } = await supabase.rpc("add_my_north_star_milestone", {
    p_north_star_id: northStarId,
    p_description: description.trim(),
  });
  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("North Star milestones");
  if (error) throw error;
  return mapMilestone(data as MilestoneRow);
}

export async function setNorthStarMilestoneStatus(milestoneId: string, status: NorthStarMilestone["status"]): Promise<NorthStarMilestone> {
  if (isOfflinePreviewMode) throw new Error("Milestone persistence is unavailable in offline preview mode.");
  const { data, error } = await supabase.rpc("set_my_north_star_milestone_status", {
    p_milestone_id: milestoneId,
    p_status: status,
  });
  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("North Star milestones");
  if (error) throw error;
  return mapMilestone(data as MilestoneRow);
}

export async function listMyCapabilities(): Promise<PersonCapability[]> {
  if (isOfflinePreviewMode) return [];
  const { data, error } = await supabase.from("person_capabilities").select("id, person_id, capability_key, label, source, status").order("updated_at", { ascending: false });
  if (isSupabaseFeatureUnavailable(error)) return [];
  if (error) throw error;
  return ((data ?? []) as CapabilityRow[]).map(mapCapability);
}

export async function setMySelfCapability(label: string, status: "developing" | "active" = "active"): Promise<PersonCapability> {
  if (isOfflinePreviewMode) throw new Error("Capability persistence is unavailable in offline preview mode.");
  const { data, error } = await supabase.rpc("set_my_self_capability", { p_capability_key: label, p_label: label.trim(), p_status: status });
  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Capabilities");
  if (error) throw error;
  return mapCapability(data as CapabilityRow);
}

export async function getMyOpportunityFitPreferences(): Promise<OpportunityFitPreferences | null> {
  if (isOfflinePreviewMode) return null;
  const { data, error } = await supabase.from("person_opportunity_preferences").select("person_id, matching_enabled, introductions_enabled, opportunity_types, time_preference, location_preference, travel_radius_miles, fit_notes, created_at, updated_at").maybeSingle();
  if (isSupabaseFeatureUnavailable(error)) return null;
  if (error) throw error;
  return data ? mapOpportunityPreferences(data as OpportunityPreferenceRow) : null;
}

export async function setMyOpportunityFitPreferences(input: { matchingEnabled: boolean; introductionsEnabled: boolean; opportunityTypes: OpportunityFitPreferences["opportunityTypes"]; timePreference?: OpportunityTimePreference | null; locationPreference?: OpportunityLocationPreference | null; travelRadiusMiles?: number | null; fitNotes?: string | null; }): Promise<OpportunityFitPreferences> {
  if (isOfflinePreviewMode) throw new Error("Opportunity fit preferences are unavailable in offline preview mode.");
  const { data, error } = await supabase.rpc("set_my_opportunity_preferences", { p_matching_enabled: input.matchingEnabled, p_introductions_enabled: input.introductionsEnabled, p_opportunity_types: input.opportunityTypes, p_time_preference: input.timePreference ?? null, p_location_preference: input.locationPreference ?? null, p_travel_radius_miles: input.travelRadiusMiles ?? null, p_fit_notes: input.fitNotes?.trim() || null });
  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Opportunity preferences");
  if (error) throw error;
  return mapOpportunityPreferences(data as OpportunityPreferenceRow);
}

export async function listOpenGrowthOpportunities(): Promise<GrowthOpportunity[]> {
  if (isOfflinePreviewMode) return [];
  const { data, error } = await supabase.from("growth_opportunities").select("id, opportunity_type, title, description, status, visibility, geographic_scope, starts_at, closes_at").eq("status", "open").eq("visibility", "network").neq("opportunity_type", "service").neq("opportunity_type", "mentorship").order("created_at", { ascending: false }).limit(24);
  if (isSupabaseFeatureUnavailable(error)) return [];
  if (error) throw error;
  return ((data ?? []) as OpportunityRow[]).map(mapOpportunity);
}

export async function listMyOpportunityMatches(): Promise<OpportunityMatch[]> {
  if (isOfflinePreviewMode) return [];
  const { data, error } = await supabase.from("opportunity_matches").select("id, opportunity_id, person_id, match_reason, north_star_alignment, capability_alignment, interest_alignment, constraint_fit, match_source, status, offered_at, matched_at, created_at, updated_at, growth_opportunities(id, opportunity_type, title, description, status, visibility, geographic_scope, starts_at, closes_at), growth_opportunity_outcomes(id, match_id, opportunity_id, person_id, outcome_summary, source_system, occurred_at, created_at)").order("matched_at", { ascending: false });
  if (isSupabaseFeatureUnavailable(error)) return [];
  if (error) throw error;
  const rows = (data ?? []) as unknown as OpportunityMatchRow[];
  return rows.flatMap((row) => {
    const opportunity = firstOpportunity(row);
    if (!opportunity || opportunity.opportunity_type === "service") return [];
    const outcome = firstOutcome(row);
    return [{ id: row.id, opportunityId: row.opportunity_id, personId: row.person_id, opportunity: mapOpportunity(opportunity), matchReason: row.match_reason, northStarAlignment: row.north_star_alignment, capabilityAlignment: row.capability_alignment, interestAlignment: row.interest_alignment, constraintFit: row.constraint_fit, matchSource: row.match_source, status: row.status, offeredAt: row.offered_at, matchedAt: row.matched_at, createdAt: row.created_at, updatedAt: row.updated_at, outcome: outcome ? mapOpportunityOutcome(outcome) : null }];
  });
}

export async function respondToMyOpportunityMatch(matchId: string, status: Extract<OpportunityMatchStatus, "viewed" | "interested" | "accepted" | "declined">): Promise<void> {
  if (isOfflinePreviewMode) throw new Error("Opportunity responses are unavailable in offline preview mode.");
  const { error } = await supabase.rpc("respond_to_my_opportunity_match", { p_match_id: matchId, p_status: status });
  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Opportunity responses");
  if (error) throw error;
}

export async function listMyContributions(): Promise<Contribution[]> {
  if (isOfflinePreviewMode) return [];
  const { data, error } = await supabase.from("contributions").select("id, person_id, beneficiary_person_id, contribution_type, source_type, source_id, source_system, metadata, occurred_at, created_at").order("occurred_at", { ascending: false }).limit(50);
  if (isSupabaseFeatureUnavailable(error)) return [];
  if (error) throw error;
  return ((data ?? []) as ContributionRow[]).map((row) => ({ id: row.id, personId: row.person_id, type: row.contribution_type, beneficiaryPersonId: row.beneficiary_person_id, sourceType: row.source_type, sourceId: row.source_id, sourceSystem: row.source_system, metadata: row.metadata ?? {}, occurredAt: row.occurred_at, createdAt: row.created_at }));
}

export async function listMyContributionCirculation(): Promise<ContributionCirculation[]> {
  if (isOfflinePreviewMode) return [];
  const { data, error } = await supabase.rpc("list_my_contribution_circulation");
  if (isSupabaseFeatureUnavailable(error)) return [];
  if (error) throw error;
  return ((data ?? []) as ContributionCirculationRow[]).map((row) => ({
    contributionId: row.contribution_id,
    opportunityId: row.opportunity_id,
    opportunityType: row.opportunity_type,
    opportunityTitle: row.opportunity_title,
    opportunityStatus: row.opportunity_status,
    capacityReason: row.capacity_reason,
    sourceSystem: row.source_system,
    createdAt: row.created_at,
  }));
}
