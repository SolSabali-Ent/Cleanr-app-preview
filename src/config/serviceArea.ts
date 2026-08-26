/**
 * Marketplace service area constraints. Single source of truth for CSP service radius.
 * Enforced in DB (CHECK + RPC), backend, and UI. Do not scatter magic numbers.
 */
export const SERVICE_RADIUS_MILES_MIN = 1;
export const SERVICE_RADIUS_MILES_MAX = 50;

export function clampServiceRadiusMiles(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  if (n < SERVICE_RADIUS_MILES_MIN) return SERVICE_RADIUS_MILES_MIN;
  if (n > SERVICE_RADIUS_MILES_MAX) return SERVICE_RADIUS_MILES_MAX;
  return n;
}

export function isValidServiceRadiusMiles(value: number | null | undefined): boolean {
  if (value == null) return true;
  if (!Number.isFinite(value)) return false;
  const n = Number(value);
  return n >= SERVICE_RADIUS_MILES_MIN && n <= SERVICE_RADIUS_MILES_MAX;
}
