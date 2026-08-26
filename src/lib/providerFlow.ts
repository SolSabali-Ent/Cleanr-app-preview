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
  application_status?: string | null;
  application_submitted_at?: string | null;
  application_approved_at?: string | null;
  marketplace_access: boolean;
};

const DASH = "/csp/dashboard";
const P = {
  candidate: `${DASH}/candidate-readiness`,
  onboarding: `${DASH}/onboarding`,
  verification: `${DASH}/verification`,
  applicationStatus: `${DASH}/application-status`,
  index: DASH,
} as const;

export function pathnameIsOnCspSetupFunnelRoute(pathname: string): boolean {
  return (
    pathname.startsWith(P.candidate) ||
    pathname.startsWith(P.onboarding) ||
    pathname.startsWith(P.verification) ||
    pathname.startsWith(P.applicationStatus)
  );
}

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export function hasProviderInterestAtValue(v: string | null | undefined): boolean {
  return Boolean((v ?? "").trim());
}

export function hasProviderInterestSubmitted(p: ProviderFlowProfile): boolean {
  return hasProviderInterestAtValue(p.provider_interest_submitted_at);
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
    application_status: p.application_status,
    application_submitted_at: p.application_submitted_at,
    application_approved_at: (p as unknown as { application_approved_at?: string | null }).application_approved_at ?? null,
    marketplace_access: p.marketplace_access === true,
  };
}

export function getCspFlowRedirectTarget(pathname: string, p: ProviderFlowProfile): string | null {
  if (p.role !== "csp") return null;
  if (!hasProviderInterestSubmitted(p)) return pathname.startsWith(P.candidate) ? null : P.candidate;
  if (p.is_onboarded !== true) return pathname.startsWith(P.onboarding) ? null : P.onboarding;
  if (!verificationSubmitted(p)) return pathname.startsWith(P.verification) ? null : P.verification;
  if (isApplicationUnderReviewLike(p)) return pathname.startsWith(P.applicationStatus) ? null : P.applicationStatus;
  if (isApplicationApprovedLike(p)) {
    const onSetupFunnel =
      pathname.startsWith(P.candidate) ||
      pathname.startsWith(P.onboarding) ||
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
