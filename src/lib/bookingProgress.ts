import { getClientRef } from "./bookingApi";
import { supabase } from "./supabase";

export type BookingProgressEventType =
  | "pre_booking_zip_started"
  | "zip_blocked_waitlist_offered"
  | "booking_started_no_booking_id"
  | "booking_created_payment_not_started"
  | "checkout_started_payment_not_completed"
  | "checkout_canceled"
  | "auth_required_checkout_blocked";

type BookingProgressEventInput = {
  eventType: BookingProgressEventType;
  currentStep?: string | null;
  bookingId?: string | null;
  zip?: string | null;
  serviceOptionKey?: string | null;
  activationReason?: string | null;
  checkoutSessionId?: string | null;
  metadata?: Record<string, unknown>;
};

export function serviceOptionKeyFromBookingService(raw: string | null | undefined): string | null {
  const normalized = (raw ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("deep")) return "deep";
  if (normalized.includes("move")) return "moveout";
  return "standard";
}

export async function recordBookingProgressEvent(input: BookingProgressEventInput): Promise<void> {
  try {
    const clientRef = getClientRef();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const zip = input.zip?.trim() ?? null;
    const safeZip = zip && /^\d{5}$/.test(zip) ? zip : null;

    const { error } = await supabase.from("booking_progress_events").insert({
      client_ref: clientRef,
      booking_id: input.bookingId ?? null,
      customer_id: user?.id ?? null,
      event_type: input.eventType,
      current_step: input.currentStep ?? null,
      zip: safeZip,
      service_option_key: input.serviceOptionKey ?? null,
      activation_reason: input.activationReason ?? null,
      checkout_session_id: input.checkoutSessionId ?? null,
      metadata: input.metadata ?? {},
    });

    if (error) {
      console.warn("[booking_progress_events] insert failed", {
        eventType: input.eventType,
        code: error.code,
      });
    }
  } catch (err) {
    console.warn("[booking_progress_events] insert exception", {
      eventType: input.eventType,
      error: err,
    });
  }
}
