import { isOfflinePreviewMode, supabase } from "@/lib/supabase";
import type {
  GrowthOpportunity,
  NorthStar,
  NorthStarCategory,
  NorthStarMilestone,
  PersonCapability,
} from "@/domain/growth";

type NorthStarRow = {
  id: string;
  person_id: string;
  goal: string;
  category: NorthStarCategory;
  current_stage: string | null;
  status: NorthStar["status"];
  created_at: string;
  updated_at: string;
};

type MilestoneRow = {
  id: string;
  north_star_id: string;
  description: string;
  status: NorthStarMilestone["status"];
  target_date: string | null;
  completed_at: string | null;
};

type CapabilityRow = {
  id: string;
  person_id: string;
  capability_key: string;
  label: string;
  source: PersonCapability["source"];
  status: PersonCapability["status"];
};

type OpportunityRow = {
  id: string;
  opportunity_type: GrowthOpportunity["type"];
  title: string;
  description: string | null;
  status: "draft" | "open" | "closed";
};

function mapNorthStar(row: NorthStarRow): NorthStar {
  return {
    id: row.id,
    personId: row.person_id,
    goal: row.goal,
    category: row.category,
    currentStage: row.current_stage,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMyNorthStar(): Promise<NorthStar | null> {
  if (isOfflinePreviewMode) return null;

  const { data, error } = await supabase
    .from("north_stars")
    .select("id, person_id, goal, category, current_stage, status, created_at, updated_at")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapNorthStar(data as NorthStarRow) : null;
}

export async function setMyNorthStar(goal: string, category: NorthStarCategory): Promise<NorthStar> {
  if (isOfflinePreviewMode) {
    throw new Error("North Star persistence is unavailable in offline preview mode.");
  }

  const { data, error } = await supabase.rpc("set_my_north_star", {
    p_goal: goal,
    p_category: category,
  });

  if (error) throw error;
  return mapNorthStar(data as NorthStarRow);
}

export async function listMyNorthStarMilestones(northStarId: string): Promise<NorthStarMilestone[]> {
  if (isOfflinePreviewMode) return [];

  const { data, error } = await supabase
    .from("north_star_milestones")
    .select("id, north_star_id, description, status, target_date, completed_at")
    .eq("north_star_id", northStarId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as MilestoneRow[]).map((row) => ({
    id: row.id,
    northStarId: row.north_star_id,
    description: row.description,
    status: row.status,
    targetDate: row.target_date,
    completedAt: row.completed_at,
  }));
}

export async function listMyCapabilities(): Promise<PersonCapability[]> {
  if (isOfflinePreviewMode) return [];

  const { data, error } = await supabase
    .from("person_capabilities")
    .select("id, person_id, capability_key, label, source, status")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as CapabilityRow[]).map((row) => ({
    id: row.id,
    personId: row.person_id,
    capabilityKey: row.capability_key,
    label: row.label,
    source: row.source,
    status: row.status,
  }));
}

export async function listOpenGrowthOpportunities(): Promise<GrowthOpportunity[]> {
  if (isOfflinePreviewMode) return [];

  const { data, error } = await supabase
    .from("growth_opportunities")
    .select("id, opportunity_type, title, description, status")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) throw error;

  return ((data ?? []) as OpportunityRow[]).map((row) => ({
    id: row.id,
    type: row.opportunity_type,
    title: row.title,
    description: row.description,
    status: "open",
  }));
}
