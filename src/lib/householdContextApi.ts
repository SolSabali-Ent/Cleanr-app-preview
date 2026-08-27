import { isOfflinePreviewMode, supabase } from "@/lib/supabase";
import type { HouseholdContext, HouseholdContextPatch } from "@/domain/householdContext";

type HouseholdContextRow = {
  customer_id: string;
  memory_enabled: boolean;
  service_preferences: string | null;
  pet_context: string | null;
  surfaces_to_avoid: string | null;
  communication_preferences: string | null;
  created_at: string;
  updated_at: string;
};

function mapHouseholdContext(row: HouseholdContextRow): HouseholdContext {
  return {
    customerId: row.customer_id,
    memoryEnabled: row.memory_enabled,
    servicePreferences: row.service_preferences,
    petContext: row.pet_context,
    surfacesToAvoid: row.surfaces_to_avoid,
    communicationPreferences: row.communication_preferences,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function relationMissing(error: { code?: string; message?: string } | null): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return error?.code === "42P01"
    || error?.code === "PGRST205"
    || (message.includes("household_context") && message.includes("does not exist"));
}

export async function getMyHouseholdContext(): Promise<HouseholdContext | null> {
  if (isOfflinePreviewMode) return null;
  const { data, error } = await supabase
    .from("household_context")
    .select("customer_id, memory_enabled, service_preferences, pet_context, surfaces_to_avoid, communication_preferences, created_at, updated_at")
    .maybeSingle();
  if (relationMissing(error)) return null;
  if (error) throw error;
  return data ? mapHouseholdContext(data as HouseholdContextRow) : null;
}

export async function getHouseholdContextForBooking(bookingId: string): Promise<HouseholdContext | null> {
  if (isOfflinePreviewMode) return null;
  const { data, error } = await supabase.rpc("get_household_context_for_booking", {
    p_booking_id: bookingId,
  });
  if (relationMissing(error)) return null;
  if (error) throw error;
  return data ? mapHouseholdContext(data as HouseholdContextRow) : null;
}

export async function setMyHouseholdContext(patch: HouseholdContextPatch): Promise<HouseholdContext> {
  if (isOfflinePreviewMode) {
    throw new Error("Household memory is unavailable in offline preview mode.");
  }

  const { data, error } = await supabase.rpc("set_my_household_context", {
    p_memory_enabled: patch.memoryEnabled,
    p_service_preferences: patch.servicePreferences?.trim() || null,
    p_pet_context: patch.petContext?.trim() || null,
    p_surfaces_to_avoid: patch.surfacesToAvoid?.trim() || null,
    p_communication_preferences: patch.communicationPreferences?.trim() || null,
  });
  if (error) throw error;
  return mapHouseholdContext(data as HouseholdContextRow);
}
