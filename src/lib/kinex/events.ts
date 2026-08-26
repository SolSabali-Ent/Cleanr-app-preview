import { sendKinexEvent } from "./sendKinexEvent";

const MARKET_REGION = "atlanta";
const SERVICE_TYPE = "residential";

/**
 * Producer semantics for `booking_confirmed`: not Stripe payment capture.
 * Kinex must treat payment-settled truth via `booking_payment_captured` (edge webhook).
 */
export const BOOKING_CONFIRMED_CONFIRMATION_SCOPE = "customer_post_booking_page" as const;

/**
 * `person_id` (v1 spine): Supabase Auth user UUID (`auth.users.id` / `profiles.id`), or
 * `bookings.customer_id` when that column is set. Not client_ref, not the literal `"anonymous"`.
 * Whether that UUID exists in Kinex `public.persons` is a cross-system contract — see `personIdForSpine.ts`.
 */
function occurredAt() {
  return new Date().toISOString();
}

/**
 * Emit booking_started when user begins the booking flow.
 * Fire-and-forget; does not block.
 */
export function emitBookingStarted(personId: string, priceEstimate: number = 0): void {
  void sendKinexEvent({
    event_type: "booking_started",
    person_id: personId,
    occurred_at: occurredAt(),
    payload: {
      service_type: SERVICE_TYPE,
      market_region_id: MARKET_REGION,
      price_estimate: priceEstimate,
    },
  });
}

/**
 * Emit booking_abandoned when user exits or leaves the flow before confirming.
 * Fire-and-forget; does not block.
 */
export function emitBookingAbandoned(
  personId: string,
  stepAbandoned: string,
  priceEstimate: number = 0
): void {
  void sendKinexEvent({
    event_type: "booking_abandoned",
    person_id: personId,
    occurred_at: occurredAt(),
    payload: {
      service_type: SERVICE_TYPE,
      market_region_id: MARKET_REGION,
      price_estimate: priceEstimate,
      step_abandoned: stepAbandoned,
    },
  });
}

/**
 * Emit `booking_confirmed` when the customer reaches the post-booking confirmation UI
 * (`/booking-confirmed`) after a booking row exists. This is schedule/UI acknowledgment,
 * not payment capture. `price_paid` is whatever `price_cents` on the row was at read time
 * (often estimate / pre-Stripe). Use `booking_payment_captured` for Stripe-settled money.
 */
export function emitBookingConfirmed(
  personId: string,
  payload: {
    booking_id: string;
    service_type: string;
    service_domain: string;
    service_option_key: string;
    service_display_name: string;
    market_region_id: string;
    price_paid: number;
    scheduled_for: string;
  }
): void {
  void sendKinexEvent({
    event_type: "booking_confirmed",
    person_id: personId,
    occurred_at: occurredAt(),
    payload: {
      ...payload,
      confirmation_scope: BOOKING_CONFIRMED_CONFIRMATION_SCOPE,
      service_type: payload.service_type || SERVICE_TYPE,
      market_region_id: payload.market_region_id || MARKET_REGION,
    },
  });
}

/**
 * Emit clean_completed when the service is marked complete by the provider.
 * Fire-and-forget; does not block.
 */
export function emitCleanCompleted(
  personId: string,
  payload: {
    booking_id: string;
    service_type: string;
    service_domain: string;
    service_option_key: string;
    service_display_name: string;
    market_region_id: string;
    provider_id: string;
    price_paid: number;
  }
): void {
  void sendKinexEvent({
    event_type: "clean_completed",
    person_id: personId,
    occurred_at: occurredAt(),
    payload: {
      ...payload,
      service_type: payload.service_type || SERVICE_TYPE,
      market_region_id: payload.market_region_id || MARKET_REGION,
    },
  });
}

/**
 * Emit review_submitted when a customer submits a review.
 * Call this from the review submission UI when it exists.
 * Fire-and-forget; does not block.
 */
export function emitReviewSubmitted(
  personId: string,
  payload: {
    booking_id: string;
    service_type: string;
    service_domain: string;
    service_option_key: string;
    service_display_name: string;
    market_region_id: string;
    rating: number;
  }
): void {
  void sendKinexEvent({
    event_type: "review_submitted",
    person_id: personId,
    occurred_at: occurredAt(),
    payload: {
      ...payload,
      service_type: payload.service_type || SERVICE_TYPE,
      market_region_id: payload.market_region_id || MARKET_REGION,
    },
  });
}

/**
 * Emit account_created when a CSP profile is durably inserted (after auth.signUp).
 * Fire-and-forget. person_id = auth user id.
 */
export function emitAccountCreated(personId: string): void {
  void sendKinexEvent({
    event_type: "account_created",
    person_id: personId,
    occurred_at: occurredAt(),
    payload: {
      role: "csp",
      market_region_id: MARKET_REGION,
    },
  });
}

/**
 * Emit onboarding_completed when CSP onboarding is durably completed (profiles.is_onboarded = true).
 * Fire-and-forget. person_id = auth user id.
 */
export function emitOnboardingCompleted(personId: string): void {
  void sendKinexEvent({
    event_type: "onboarding_completed",
    person_id: personId,
    occurred_at: occurredAt(),
    payload: {
      role: "csp",
      market_region_id: MARKET_REGION,
    },
  });
}

/**
 * Emit booking_created immediately after durable create_booking_geo success (booking row exists).
 * Fire-and-forget. person_id = getClientRef() (pre-auth/anonymous) or customer_id when linked.
 */
export function emitBookingCreated(
  personId: string,
  payload: {
    booking_id: string;
    service_type: string;
    service_domain: string;
    service_option_key: string;
    service_display_name: string;
    market_region_id: string;
    scheduled_for: string;
  }
): void {
  void sendKinexEvent({
    event_type: "booking_created",
    person_id: personId,
    occurred_at: occurredAt(),
    payload: {
      ...payload,
      service_type: payload.service_type || SERVICE_TYPE,
      market_region_id: payload.market_region_id || MARKET_REGION,
    },
  });
}

/**
 * After durable profiles update for residential CSP candidate readiness (client path).
 * Fire-and-forget; person_id = auth user id.
 */
export function emitProviderInterestSubmitted(
  personId: string,
  payload: {
    cleaning_experience_bucket: string;
    has_own_equipment: boolean;
    has_reliable_transportation: boolean;
    provider_review_band: string;
    scope: string;
  }
): void {
  void sendKinexEvent({
    event_type: "provider_interest_submitted",
    person_id: personId,
    occurred_at: occurredAt(),
    payload: {
      ...payload,
      service_type: SERVICE_TYPE,
      market_region_id: MARKET_REGION,
    },
  });
}
