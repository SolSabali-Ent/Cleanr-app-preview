/**
 * Spine `person_id` for Kinex ingestion.
 *
 * **Confirmed in Cleanr:** Authenticated users have `auth.users.id` (UUID), stored as
 * `profiles.id`, `bookings.customer_id`, and CSP session user id — these are the only
 * producer-side IDs this codebase treats as stable person keys.
 *
 * **Unknown / cross-system:** Whether Kinex `public.persons.id` is always the same UUID
 * must be guaranteed by your Kinex identity bridge or ingestion contract — not asserted here.
 *
 * **Explicitly not Kinex persons:** `getClientRef()` browser UUIDs, literal `"anonymous"`,
 * or any value not originating from Supabase Auth for a real user.
 */

/** Prefer booking.customer_id; else authenticated customer session (e.g. post-login). */
export function spinePersonIdFromBookingAndCustomerSession(
  bookingCustomerId: string | null | undefined,
  authUserId: string | null | undefined
): string | null {
  const bc = bookingCustomerId?.trim();
  if (bc) return bc;
  const au = authUserId?.trim();
  if (au) return au;
  return null;
}

/** Prefer the customer on the booking; if absent, the CSP who completed (always authenticated in app). */
export function spinePersonIdForCleanCompleted(
  bookingCustomerId: string | null | undefined,
  completingProviderAuthId: string | null | undefined
): string | null {
  const bc = bookingCustomerId?.trim();
  if (bc) return bc;
  const pid = completingProviderAuthId?.trim();
  if (pid) return pid;
  return null;
}
