import type {
  HouseholdMemorySuggestion,
  HouseholdMemorySuggestionField,
} from "@/domain/householdMemorySuggestion";
import { isOfflinePreviewMode, supabase } from "@/lib/supabase";
import { dormantFeatureError, isSupabaseFeatureUnavailable } from "@/lib/supabaseFeature";

type HouseholdMemorySuggestionRow = {
  id: string;
  booking_id: string;
  customer_id: string;
  suggested_by_provider_id: string;
  context_field: HouseholdMemorySuggestionField;
  suggested_text: string;
  status: HouseholdMemorySuggestion["status"];
  customer_final_text: string | null;
  created_at: string;
  responded_at: string | null;
  updated_at: string;
};

function mapSuggestion(row: HouseholdMemorySuggestionRow): HouseholdMemorySuggestion {
  return {
    id: row.id,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    suggestedByProviderId: row.suggested_by_provider_id,
    contextField: row.context_field,
    suggestedText: row.suggested_text,
    status: row.status,
    customerFinalText: row.customer_final_text,
    createdAt: row.created_at,
    respondedAt: row.responded_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_FIELDS = "id, booking_id, customer_id, suggested_by_provider_id, context_field, suggested_text, status, customer_final_text, created_at, responded_at, updated_at";

export async function listHouseholdMemorySuggestionsForBooking(bookingId: string): Promise<HouseholdMemorySuggestion[]> {
  if (isOfflinePreviewMode) return [];
  const { data, error } = await supabase
    .from("household_memory_suggestions")
    .select(SELECT_FIELDS)
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  if (isSupabaseFeatureUnavailable(error)) return [];
  if (error) throw error;
  return (data ?? []).map((row) => mapSuggestion(row as HouseholdMemorySuggestionRow));
}

export async function suggestHouseholdMemoryFromBooking(
  bookingId: string,
  contextField: HouseholdMemorySuggestionField,
  suggestedText: string
): Promise<HouseholdMemorySuggestion> {
  if (isOfflinePreviewMode) {
    throw new Error("Household memory suggestions are unavailable in offline preview mode.");
  }
  const { data, error } = await supabase.rpc("suggest_household_memory_from_booking", {
    p_booking_id: bookingId,
    p_context_field: contextField,
    p_suggested_text: suggestedText.trim(),
  });
  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Household learning");
  if (error) throw error;
  return mapSuggestion(data as HouseholdMemorySuggestionRow);
}

export async function withdrawMyHouseholdMemorySuggestion(suggestionId: string): Promise<HouseholdMemorySuggestion> {
  if (isOfflinePreviewMode) {
    throw new Error("Household memory suggestions are unavailable in offline preview mode.");
  }
  const { data, error } = await supabase.rpc("withdraw_my_household_memory_suggestion", {
    p_suggestion_id: suggestionId,
  });
  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Household learning");
  if (error) throw error;
  return mapSuggestion(data as HouseholdMemorySuggestionRow);
}

export async function respondToHouseholdMemorySuggestion(
  suggestionId: string,
  response: "accepted" | "declined",
  finalText?: string | null
): Promise<HouseholdMemorySuggestion> {
  if (isOfflinePreviewMode) {
    throw new Error("Household memory suggestions are unavailable in offline preview mode.");
  }
  const { data, error } = await supabase.rpc("respond_to_household_memory_suggestion", {
    p_suggestion_id: suggestionId,
    p_response: response,
    p_final_text: finalText?.trim() || null,
  });
  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Household learning");
  if (error) throw error;
  return mapSuggestion(data as HouseholdMemorySuggestionRow);
}
