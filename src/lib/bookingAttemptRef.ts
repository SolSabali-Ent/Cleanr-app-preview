const CLIENT_REF_KEY = "cleanr_booking_client_ref";
const LEGACY_CLIENT_REF_KEY = "cleanr_client_ref";

/**
 * Start a fresh booking-attempt identity.
 *
 * `bookings.client_ref` is unique in durable booking truth, so it must not be a
 * browser-lifetime identity. Keep the value stable while one booking flow is
 * active, then rotate it when a new flow starts. Existing readers in bookingApi
 * intentionally continue to use the same storage keys.
 */
export function startBookingAttemptRef(): string {
  const ref = crypto.randomUUID();
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(CLIENT_REF_KEY, ref);
    localStorage.setItem(LEGACY_CLIENT_REF_KEY, ref);
  }
  return ref;
}
