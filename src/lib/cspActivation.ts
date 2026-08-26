/**
 * Canonical CSP activation criteria (app-side).
 * DB enforces Stripe via profiles_guardrails; admin approval should use
 * admin_approve_provider_application RPC which checks all criteria server-side.
 */

export const IDENTITY_VERIFIED_VALUES = ["verified", "approved", "completed"] as const;
export const BACKGROUND_CLEAR_VALUES = ["approved", "verified", "clear"] as const;
export const SCREENING_READY_VALUES = ["scheduled", "completed", "waived"] as const;
export const TRAVEL_READY_VALUES = ["submitted", "completed"] as const;

export type ActivationCheck = {
  key: string;
  label: string;
  passed: boolean;
  value: string | boolean | null;
};

export interface ProfileForActivation {
  role?: string | null;
  is_onboarded?: boolean | null;
  csp_terms_accepted_at?: string | null;
  identity_status?: string | null;
  background_check_status?: string | null;
  screening_status?: string | null;
  travel_readiness_status?: string | null;
  marketplace_access?: boolean | null;
}

function normalizedIn(value: string | null | undefined, allowed: readonly string[]): boolean {
  if (value == null || value === "") return false;
  return allowed.includes(value.toLowerCase());
}

/**
 * Returns per-criterion checks for activation. Does not include Stripe (checked in DB).
 */
export function getActivationChecks(profile: ProfileForActivation | null): ActivationCheck[] {
  if (!profile) return [];

  const roleOk = profile.role === "csp";
  const onboarded = profile.is_onboarded === true;
  const termsAccepted = profile.csp_terms_accepted_at != null;
  const identityOk = normalizedIn(profile.identity_status, [...IDENTITY_VERIFIED_VALUES]);
  const backgroundOk = normalizedIn(profile.background_check_status, [...BACKGROUND_CLEAR_VALUES]);
  const screeningOk = normalizedIn(profile.screening_status, [...SCREENING_READY_VALUES]);
  const travelOk = normalizedIn(profile.travel_readiness_status, [...TRAVEL_READY_VALUES]);

  return [
    { key: "role", label: "CSP role", passed: roleOk, value: profile.role ?? null },
    { key: "onboarded", label: "Onboarding complete", passed: onboarded, value: onboarded },
    { key: "terms", label: "CSP terms accepted", passed: termsAccepted, value: termsAccepted },
    { key: "identity", label: "ID verification", passed: identityOk, value: profile.identity_status ?? null },
    { key: "background", label: "Background check", passed: backgroundOk, value: profile.background_check_status ?? null },
    { key: "screening", label: "Screening", passed: screeningOk, value: profile.screening_status ?? null },
    { key: "travel", label: "Transportation readiness", passed: travelOk, value: profile.travel_readiness_status ?? null },
  ];
}

/**
 * True only if all app-visible activation criteria are met.
 * Stripe is enforced by DB trigger when marketplace_access is set.
 */
export function canBeActivated(profile: ProfileForActivation | null): boolean {
  const checks = getActivationChecks(profile);
  return checks.length > 0 && checks.every((c) => c.passed);
}
