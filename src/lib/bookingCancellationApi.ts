import { supabase } from "./supabase";

export type BookingCancellationQuote = {
  booking_id: string;
  policy: "free" | "late";
  paid: boolean;
  scheduled_start: string;
  service_price_cents: number;
  refund_cents: number;
  cancellation_fee_cents: number;
  provider_compensation_cents: number;
  platform_retained_cents: number;
  provider_assigned: boolean;
};

type CancellationResponse = {
  ok?: boolean;
  already_cancelled?: boolean;
  refund_pending?: boolean;
  refund_id?: string;
  refund_status?: string | null;
  quote?: BookingCancellationQuote;
  error?: string;
  detail?: string;
};

function cancellationError(result: CancellationResponse | null, fallback: string): Error {
  const code = result?.error ?? fallback;
  if (code === "booking_already_started_or_missed") return new Error("This visit can no longer be cancelled from the app.");
  if (code === "booking_cannot_be_cancelled") return new Error("This visit can no longer be cancelled.");
  if (code === "provider_payout_already_released") return new Error("This booking needs Cleanr support before it can be cancelled.");
  if (code === "captured_payment_required") return new Error("We couldn't verify the payment yet. Please try again shortly.");
  return new Error(result?.detail || code.replaceAll("_", " "));
}

export async function getBookingCancellationQuote(bookingId: string): Promise<BookingCancellationQuote> {
  const { data, error } = await supabase.functions.invoke("cancel-paid-booking", {
    body: { booking_id: bookingId, action: "quote" },
  });
  if (error) throw error;
  const result = data as CancellationResponse | null;
  if (!result?.ok || !result.quote) throw cancellationError(result, "cancellation_quote_failed");
  return result.quote;
}

export async function confirmBookingCancellation(bookingId: string): Promise<CancellationResponse> {
  const { data, error } = await supabase.functions.invoke("cancel-paid-booking", {
    body: { booking_id: bookingId, action: "confirm" },
  });
  if (error) throw error;
  const result = data as CancellationResponse | null;
  if (!result?.ok) throw cancellationError(result, "cancellation_failed");
  return result;
}
