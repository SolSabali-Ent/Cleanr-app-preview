import { supabase } from "./supabase";

/**
 * Stores or clears the authenticated customer's requested marketplace CSP on an
 * unpaid booking. The database boundary revalidates exact address, work
 * preferences, weekly availability, capacity, time off, and schedule conflicts.
 */
export async function setMyBookingRequestedProvider(
  bookingId: string,
  providerId: string | null,
): Promise<void> {
  const normalizedBookingId = bookingId.trim();
  const normalizedProviderId = providerId?.trim() || null;
  if (!normalizedBookingId) throw new Error("booking_id_required");

  const { error } = await supabase.rpc("set_my_booking_requested_provider", {
    p_booking_id: normalizedBookingId,
    p_provider_id: normalizedProviderId,
  });
  if (error) throw error;
}
