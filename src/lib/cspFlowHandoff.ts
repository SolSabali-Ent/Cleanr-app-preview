import { hasProviderInterestAtValue, type ProviderFlowProfile } from "@/lib/providerFlow";

const HANDOFF_PREFIX = "cleanr:csp:";
const INTEREST_SUFFIX = ":provider_interest_submitted";
const ONBOARDING_COMPLETE_SUFFIX = ":onboarding_complete";

/** Sentinel merged into flow profile when handoff proves interest before DB reflects it. */
export const PROVIDER_INTEREST_HANDOFF_SENTINEL = "__handoff__";

/** Sentinel merged into waiver when onboarding-complete handoff proves waiver before DB reflects it. */
export const ONBOARDING_COMPLETE_HANDOFF_SENTINEL = "__onboarding_handoff__";

function interestKey(uid: string): string {
  return `${HANDOFF_PREFIX}${uid}${INTEREST_SUFFIX}`;
}

function onboardingCompleteKey(uid: string): string {
  return `${HANDOFF_PREFIX}${uid}${ONBOARDING_COMPLETE_SUFFIX}`;
}

export function setProviderInterestHandoff(uid: string): void {
  if (!uid || typeof window === "undefined") return;
  sessionStorage.setItem(interestKey(uid), "true");
}

export function hasProviderInterestHandoff(uid: string | null | undefined): boolean {
  if (!uid || typeof window === "undefined") return false;
  return sessionStorage.getItem(interestKey(uid)) === "true";
}

export function clearProviderInterestHandoff(uid: string | null | undefined): void {
  if (!uid || typeof window === "undefined") return;
  sessionStorage.removeItem(interestKey(uid));
}

export function setOnboardingCompleteHandoff(uid: string): void {
  if (!uid || typeof window === "undefined") return;
  sessionStorage.setItem(onboardingCompleteKey(uid), "true");
}

export function hasOnboardingCompleteHandoff(uid: string | null | undefined): boolean {
  if (!uid || typeof window === "undefined") return false;
  return sessionStorage.getItem(onboardingCompleteKey(uid)) === "true";
}

export function clearOnboardingCompleteHandoff(uid: string | null | undefined): void {
  if (!uid || typeof window === "undefined") return;
  sessionStorage.removeItem(onboardingCompleteKey(uid));
}

/**
 * Applies session handoffs for CSP setup routing so {@link getCspFlowRedirectTarget} stays monotonic
 * when the resolver row lags behind client-completed steps.
 */
export function mergeFlowProfileWithHandoffs<T extends ProviderFlowProfile>(profile: T, uid: string | null | undefined): T {
  if (!uid) return profile;
  const interestHandoff = hasProviderInterestHandoff(uid);
  const onboardingHandoff = hasOnboardingCompleteHandoff(uid);

  return {
    ...profile,
    provider_interest_submitted_at:
      interestHandoff && !hasProviderInterestAtValue(profile.provider_interest_submitted_at)
        ? PROVIDER_INTEREST_HANDOFF_SENTINEL
        : profile.provider_interest_submitted_at,
    is_onboarded: onboardingHandoff ? true : profile.is_onboarded,
    waiver_accepted_at:
      onboardingHandoff && !hasProviderInterestAtValue(profile.waiver_accepted_at)
        ? ONBOARDING_COMPLETE_HANDOFF_SENTINEL
        : profile.waiver_accepted_at,
  };
}
