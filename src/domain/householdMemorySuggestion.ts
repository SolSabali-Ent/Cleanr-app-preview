export type HouseholdMemorySuggestionField =
  | "service_preferences"
  | "pet_context"
  | "surfaces_to_avoid"
  | "communication_preferences";

export type HouseholdMemorySuggestionStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "withdrawn";

export interface HouseholdMemorySuggestion {
  id: string;
  bookingId: string;
  customerId: string;
  suggestedByProviderId: string;
  contextField: HouseholdMemorySuggestionField;
  suggestedText: string;
  status: HouseholdMemorySuggestionStatus;
  customerFinalText?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  updatedAt: string;
}

export const HOUSEHOLD_MEMORY_SUGGESTION_FIELDS: Array<{
  value: HouseholdMemorySuggestionField;
  label: string;
  guidance: string;
}> = [
  {
    value: "service_preferences",
    label: "Service preference",
    guidance: "A reusable preference about how this household likes service handled.",
  },
  {
    value: "pet_context",
    label: "Pet context",
    guidance: "Only pet details that are genuinely useful across visits.",
  },
  {
    value: "surfaces_to_avoid",
    label: "Surface or item to avoid",
    guidance: "A reusable care boundary for a surface, object, or area.",
  },
  {
    value: "communication_preferences",
    label: "Communication preference",
    guidance: "A reusable preference about how the household wants service communication handled.",
  },
];

export function householdMemorySuggestionFieldLabel(field: HouseholdMemorySuggestionField): string {
  return HOUSEHOLD_MEMORY_SUGGESTION_FIELDS.find((item) => item.value === field)?.label ?? "Household preference";
}
