type TraceOwner =
  | "resolver"
  | "gate"
  | "candidate-readiness"
  | "signup"
  | "onboarding-route"
  | "onboarding"
  | "verification"
  | "application-status";

type TracePayload = {
  branch: string;
  reason: string;
  pathname?: string;
  uid?: string | null;
  profileId?: string | null;
  provider_interest_submitted_at?: string | null;
  provider_review_band?: string | null;
  interestSubmitted?: boolean;
  is_onboarded?: boolean;
  waiver_accepted_at?: string | null;
  csp_terms_accepted_at?: string | null;
  identity_status?: string | null;
  readiness_status?: string | null;
  background_check_status?: string | null;
  screening_status?: string | null;
  travel_readiness_status?: string | null;
  application_status?: string | null;
  application_submitted_at?: string | null;
  application_approved_at?: string | null;
  marketplace_access?: boolean;
  target?: string | null;
  flags?: Record<string, boolean>;
  handoffInterestSubmitted?: boolean;
  handoffOnboardingComplete?: boolean;
  mergedIsOnboarded?: boolean;
  mergedWaiverAccepted?: boolean;
  handoffBefore?: boolean;
  handoffAfter?: boolean;
  computedInterestSubmitted?: boolean;
  provider_interest_submitted_at_after_merge?: string | null;
  submitSource?: string;
};

const DEV = import.meta.env.DEV;

export function traceCspFlow(owner: TraceOwner, payload: TracePayload): void {
  if (!DEV) return;
  console.info("[csp-flow-trace]", {
    ts: new Date().toISOString(),
    owner,
    ...payload,
  });
}
