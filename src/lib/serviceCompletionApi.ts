import type { Booking } from "@/domain/booking";
import { supabase } from "@/lib/supabase";

/**
 * Customer confirms a provider-completed residential service through the bounded RPC.
 *
 * The booking remains the authoritative transaction record. Confirmation creates no score,
 * contribution, relationship claim, or Kinex decision; downstream durable relationship state
 * may reconcile from the confirmed booking separately.
 */
export async function confirmMyCompletedService(bookingId: string): Promise<Booking> {
  const { data, error } = await supabase.rpc("confirm_booking_as_customer", {
    p_booking_id: bookingId,
  });

  if (error) throw error;
  if (!data) throw new Error("No booking returned after confirmation.");
  return data as Booking;
}
