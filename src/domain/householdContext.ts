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

const SECURITY_TERM_PATTERN = /\b(gate|door|entry|access|alarm|garage|keypad|lock|password|passcode|code|pin|key)\b/i;
const CREDENTIAL_LIKE_DIGITS_PATTERN = /\d{3,}/;

/**
 * Conservative client-side mirror of the database purpose-limit guard. This is not the
 * security boundary by itself; the backend enforces the same rule before durable persistence.
 */
export function householdMemoryTextIsSafe(value: string | null | undefined): boolean {
  const text = value?.trim() ?? "";
  if (!text) return true;
  if (text.length > 1000) return false;
  return !SECURITY_TERM_PATTERN.test(text) && !CREDENTIAL_LIKE_DIGITS_PATTERN.test(text);
}

export function householdContextPatchIsSafe(patch: HouseholdContextPatch): boolean {
  if (!patch.memoryEnabled) return true;
  return [
    patch.servicePreferences,
    patch.petContext,
    patch.surfacesToAvoid,
    patch.communicationPreferences,
  ].every(householdMemoryTextIsSafe);
}

export function householdContextHasUsefulMemory(context: HouseholdContext | null | undefined): boolean {
  if (!context?.memoryEnabled) return false;
  return Boolean(
    context.servicePreferences?.trim()
      || context.petContext?.trim()
      || context.surfacesToAvoid?.trim()
      || context.communicationPreferences?.trim()
  );
}
