/**
 * Consent-aware household memory.
 *
 * This is deliberately narrower than booking access details. Persistent memory is for
 * reusable household preferences only; credentials, door/gate codes, and one-visit entry
 * instructions remain booking-specific and must never be copied into this object.
 */

export interface HouseholdContext {
  customerId: string;
  memoryEnabled: boolean;
  servicePreferences?: string | null;
  petContext?: string | null;
  surfacesToAvoid?: string | null;
  communicationPreferences?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type HouseholdContextPatch = Pick<
  HouseholdContext,
  | "memoryEnabled"
  | "servicePreferences"
  | "petContext"
  | "surfacesToAvoid"
  | "communicationPreferences"
>;

export function householdContextHasUsefulMemory(context: HouseholdContext | null | undefined): boolean {
  if (!context?.memoryEnabled) return false;
  return Boolean(
    context.servicePreferences?.trim()
      || context.petContext?.trim()
      || context.surfacesToAvoid?.trim()
      || context.communicationPreferences?.trim()
  );
}
