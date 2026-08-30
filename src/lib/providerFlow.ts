import type { Profile } from "./useProfile";

export type ProviderFlowProfile = {
  id?: string;
  role: string;
  provider_interest_submitted_at?: string | null;
  is_onboarded: boolean;
  csp_terms_accepted_at?: string | null;
  waiver_accepted_at?: string | null;
  identity_status?: string | null;
  readiness_status?: string | null;
  background_check_status?: string | null;
  screening_status?: string | null;
  travel_readiness_status?: string | null;
  application_status?: string | null;
  application_submitted_at?: string | null;
  application_approved_at?: string | null;
  rejection_reason?: string | null;
  stripe_connect_ready?: boolean | null;
  stripe_connect_account_id?: string | null;
  marketplace_access: boolean;
};

const DASH = "/csp/dashboard";
const P = {
  candidate: `${DASH}/candidate-readiness`,
  onboarding: `${DASH}/onboarding`,
  terms: `${DASH}/terms`,
  application: `${DASH}/application`,
  verification: `${DASH}/verification`,
  applicationStatus: `${DASH}/application-status`,
  index: DASH,
} as const;

export function pathnameIsOnCspSetupFunnelRoute(pathname: string): boolean {
  return (
    pathname.startsWith(P.candidate) ||
    pathname.startsWith(P.onboarding) ||
    pathname.startsWith(P.terms) ||
    pathname.startsWith(P.application) ||
    pathname.startsWith(P.verification) ||
    pathname.startsWith(P.applicationStatus)
  );
}

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

function statusIn(v: string | null | undefined, allowed: readonly string[]): boolean {
  return allowed.includes(norm(v));
}

export function hasProviderInterestAtValue(v: string | null | undefined): boolean {
  return Boolean((v ?? "").trim());
}

export function hasProviderInterestSubmitted(p: ProviderFlowProfile): boolean {
  return hasProviderInterestAtValue(p.provider_interest_submitted_at);
}

export function hasRequiredApplicationSubmissions(p: ProviderFlowProfile): boolean {
  const identitySubmitted = statusIn(p.identity_status, [
    "submitted",
    "under_review",
    "pending",
    "verified",
    "approved",
    "completed",
  ]);
  const backgroundSubmitted = statusIn(p.background_check_status, [
    "submitted",
    "under_review",
    "pending",
    "approved",
    "verified",
    "clear",
    "completed",
  ]);
  const screeningSubmitted = statusIn(p.screening_status, [
    "scheduled",
    "submitted",
    "under_review",
    "pending",
    "in_progress",
    "completed",
    "waived",
    "approved",
    "verified",
    "clear",
  ]);
  const travelSubmitted = statusIn(p.travel_readiness_status, [
    "submitted",
    "under_review",
    "pending",
    "completed",
  ]);

  return identitySubmitted && backgroundSubmitted && screeningSubmitted && travelSubmitted;
}

export function verificationSubmitted(p: ProviderFlowProfile): boolean {
  if (p.application_submitted_at && String(p.application_submitted_at).trim() !== "") return true;
  const status = norm(p.application_status);
  if (["under_review", "approved", "waitlisted", "rejected", "needs_review"].includes(status)) return true;
  const id = norm(p.identity_status);
  const ready = norm(p.readiness_status);
  return id === "submitted" && ready === "submitted";
}

export function isApplicationApprovedLike(p: ProviderFlowProfile): boolean {
  const status = norm(p.application_status);
  return status === "approved" || status === "waitlisted";
}

export function isApplicationUnderReviewLike(p: ProviderFlowProfile): boolean {
  const status = norm(p.application_status);
  return status === "under_review" || status === "needs_review" || status === "rejected";
}

export function profileToProviderFlow(p: Profile): ProviderFlowProfile {
  return {
    id: p.id,
    role: p.role,
    provider_interest_submitted_at: p.provider_interest_submitted_at,
    is_onboarded: p.is_onboarded === true,
    csp_terms_accepted_at: p.csp_terms_accepted_at,
    waiver_accepted_at: (p as unknown as { waiver_accepted_at?: string | null }).waiver_accepted_at ?? null,
    identity_status: p.identity_status,
    readiness_status: (p as unknown as { readiness_status?: string | null }).readiness_status ?? null,
    background_check_status: p.background_check_status,
    screening_status: p.screening_status,
    travel_readiness_status: p.travel_readiness_status,
    application_status: p.application_status,
    application_submitted_at: p.application_submitted_at,
    application_approved_at: (p as unknown as { application_approved_at?: string | null }).application_approved_at ?? null,
    rejection_reason: p.rejection_reason,
    stripe_connect_ready: p.stripe_connect_ready,
    stripe_connect_account_id: p.stripe_connect_account_id,
    marketplace_access: p.marketplace_access === true,
  };
}

export function getCspFlowRedirectTarget(pathname: string, p: ProviderFlowProfile): string | null {
  if (p.role !== "csp") return null;
  if (!hasProviderInterestSubmitted(p)) return pathname.startsWith(P.candidate) ? null : P.candidate;
  if (p.is_onboarded !== true) return pathname.startsWith(P.onboarding) ? null : P.onboarding;

  // Terms are person-owned required setup truth and must outrank application-review state.
  if (!hasProviderInterestAtValue(p.csp_terms_accepted_at)) {
    return pathname.startsWith(P.terms) ? null : P.terms;
  }

  // An application decision must never hide unfinished person-owned submissions. This also
  // recovers partially migrated CSPs whose application was moved into review too early.
  if (!hasRequiredApplicationSubmissions(p)) {
    return pathname.startsWith(P.application) ? null : P.application;
  }

  if (!verificationSubmitted(p)) return pathname.startsWith(P.verification) ? null : P.verification;
  if (isApplicationUnderReviewLike(p)) return pathname.startsWith(P.applicationStatus) ? null : P.applicationStatus;
  if (isApplicationApprovedLike(p)) {
    const onSetupFunnel =
      pathname.startsWith(P.candidate) ||
      pathname.startsWith(P.onboarding) ||
      pathname.startsWith(P.terms) ||
      pathname.startsWith(P.application) ||
      pathname.startsWith(P.verification) ||
      pathname.startsWith(P.applicationStatus);
    if (onSetupFunnel) return P.index;
    return null;
  }
  return null;
}

export function shouldShowMarketplacePendingPanel(p: ProviderFlowProfile): boolean {
  return p.role === "csp" && p.is_onboarded === true && isApplicationApprovedLike(p) && p.marketplace_access !== true;
}
