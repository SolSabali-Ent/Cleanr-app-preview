/**
 * Canonical app-side mirror of provider application approval readiness.
 *
 * The database remains authoritative through admin_approve_provider_application.
 * Approval is separate from marketplace access: Stripe Connect and other market-access
 * guardrails remain independently enforced after application approval.
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
  id?: string | null;
  role?: string | null;
  is_onboarded?: boolean | null;
  csp_terms_accepted_at?: string | null;
  identity_document_path?: string | null;
  identity_status?: string | null;
  background_check_status?: string | null;
  screening_status?: string | null;
  travel_readiness_status?: string | null;
  marketplace_access?: boolean | null;
}

export interface ProviderReviewForActivation {
  review_type: string;
  outcome: string;
  reviewed_by: string;
  reviewed_evidence_ref?: string | null;
}

export interface ProviderApprovalReviewEvidence {
  /** Durable independent identity review of the provider's currently registered identity evidence. */
  identityVerifiedReview?: boolean;
  /** Durable independent provider_verification_reviews row with review_type=background, outcome=clear. */
  backgroundClearReview?: boolean;
}

function normalizedIn(value: string | null | undefined, allowed: readonly string[]): boolean {
  if (value == null || value === "") return false;
  return allowed.includes(value.trim().toLowerCase());
}

/**
 * Canonical app-side review truth used by admin surfaces.
 *
 * Identity approval-grade review is intentionally evidence-specific: a prior verified
 * review does not count when its reviewed_evidence_ref differs from the provider's
 * currently registered identity_document_path. This mirrors the authoritative
 * admin_approve_provider_application RPC and the admin verification truth projection.
 */
export function getProviderApprovalReviewEvidence(
  profile: Pick<ProfileForActivation, "id" | "identity_document_path"> | null,
  reviews: readonly ProviderReviewForActivation[]
): ProviderApprovalReviewEvidence {
  if (!profile?.id) {
    return { identityVerifiedReview: false, backgroundClearReview: false };
  }

  const providerId = profile.id;
  const currentIdentityEvidence = profile.identity_document_path?.trim() || null;

  return {
    identityVerifiedReview:
      currentIdentityEvidence != null &&
      reviews.some(
        (review) =>
          review.review_type.trim().toLowerCase() === "identity" &&
          review.outcome.trim().toLowerCase() === "verified" &&
          review.reviewed_by !== providerId &&
          (review.reviewed_evidence_ref?.trim() || null) === currentIdentityEvidence
      ),
    backgroundClearReview: reviews.some(
      (review) =>
        review.review_type.trim().toLowerCase() === "background" &&
        review.outcome.trim().toLowerCase() === "clear" &&
        review.reviewed_by !== providerId
    ),
  };
}

/**
 * Returns the app-visible checks required by the canonical provider approval RPC.
 *
 * Review evidence is intentionally safe-by-default: omitted review evidence fails the
 * corresponding checks. A profile status alone is not proof that independent review
 * was durably recorded.
 */
export function getActivationChecks(
  profile: ProfileForActivation | null,
  reviewEvidence: ProviderApprovalReviewEvidence = {}
): ActivationCheck[] {
  if (!profile) return [];

  const roleOk = profile.role === "csp";
  const onboarded = profile.is_onboarded === true;
  const termsAccepted = profile.csp_terms_accepted_at != null;
  const identityDocumentPresent = Boolean(profile.identity_document_path?.trim());
  const identityOk = normalizedIn(profile.identity_status, IDENTITY_VERIFIED_VALUES);
  const identityReviewOk = reviewEvidence.identityVerifiedReview === true;
  const backgroundOk = normalizedIn(profile.background_check_status, BACKGROUND_CLEAR_VALUES);
  const backgroundReviewOk = reviewEvidence.backgroundClearReview === true;
  const screeningOk = normalizedIn(profile.screening_status, SCREENING_READY_VALUES);
  const travelOk = normalizedIn(profile.travel_readiness_status, TRAVEL_READY_VALUES);

  return [
    { key: "role", label: "CSP role", passed: roleOk, value: profile.role ?? null },
    { key: "onboarded", label: "Onboarding complete", passed: onboarded, value: onboarded },
    { key: "terms", label: "CSP terms accepted", passed: termsAccepted, value: termsAccepted },
    { key: "identity_document", label: "Identity document submitted", passed: identityDocumentPresent, value: identityDocumentPresent },
    { key: "identity_status", label: "Identity verified", passed: identityOk, value: profile.identity_status ?? null },
    { key: "identity_review", label: "Independent identity review recorded", passed: identityReviewOk, value: identityReviewOk },
    { key: "background_status", label: "Background cleared", passed: backgroundOk, value: profile.background_check_status ?? null },
    { key: "background_review", label: "Independent background review recorded", passed: backgroundReviewOk, value: backgroundReviewOk },
    { key: "screening", label: "Screening ready", passed: screeningOk, value: profile.screening_status ?? null },
    { key: "travel", label: "Transportation readiness submitted", passed: travelOk, value: profile.travel_readiness_status ?? null },
  ];
}

/** True only if every app-visible provider application approval criterion is met. */
export function canBeActivated(
  profile: ProfileForActivation | null,
  reviewEvidence: ProviderApprovalReviewEvidence = {}
): boolean {
  const checks = getActivationChecks(profile, reviewEvidence);
  return checks.length > 0 && checks.every((check) => check.passed);
}
