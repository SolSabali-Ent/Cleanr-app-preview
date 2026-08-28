import { sendKinexEvent } from "./sendKinexEvent";

const MARKET_REGION = "atlanta";
const SERVICE_TYPE = "residential";

function occurredAt() {
  return new Date().toISOString();
}

/**
 * Experience signal: user begins the booking flow. This is navigation/funnel state, not durable
 * booking truth, so browser emission is appropriate.
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
 * Experience signal: user leaves or is blocked before checkout. This is funnel state, not durable
 * product truth, so browser emission is appropriate.
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
