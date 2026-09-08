const CLIENT_REF_KEY = "cleanr_booking_client_ref";
const LEGACY_CLIENT_REF_KEY = "cleanr_client_ref";

/**
 * Start a fresh booking-attempt identity.
 *
 * `bookings.client_ref` is unique in durable booking truth, so it must not be a
 * browser-lifetime identity. Keep the value stable while one booking flow is
 * active, then rotate it only when Cleanr intentionally starts a new attempt.
 */
export function startBookingAttemptRef(): string {
  const ref = crypto.randomUUID();
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(CLIENT_REF_KEY, ref);
    localStorage.setItem(LEGACY_CLIENT_REF_KEY, ref);
  }
  return ref;
}

/**
 * Reuse the active booking attempt when the customer leaves and returns to the
 * booking surface. This keeps durable idempotency aligned with the persisted
 * booking draft instead of silently starting a second attempt on remount.
 */
export function ensureBookingAttemptRef(): string {
  if (typeof localStorage === "undefined") return crypto.randomUUID();
  const existing = localStorage.getItem(CLIENT_REF_KEY) || localStorage.getItem(LEGACY_CLIENT_REF_KEY);
  if (existing?.trim()) {
    localStorage.setItem(CLIENT_REF_KEY, existing);
    localStorage.setItem(LEGACY_CLIENT_REF_KEY, existing);
    return existing;
  }
  return startBookingAttemptRef();
}

export function clearBookingAttemptRef() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(CLIENT_REF_KEY);
  localStorage.removeItem(LEGACY_CLIENT_REF_KEY);
}
