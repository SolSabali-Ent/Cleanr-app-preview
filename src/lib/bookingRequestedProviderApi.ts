import { supabase } from "./supabase";

/**
 * Stores or clears the authenticated customer's requested marketplace CSP on an
 * unpaid booking. The database boundary revalidates exact address, provider-owned
 * work intake/preferences, weekly availability, capacity, time off, and conflicts.
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
  if (error) {
    // Keep the checkout-facing error taxonomy stable while the durable DB keeps the
    // more precise distinction between Cleanr eligibility and CSP-owned intake.
    if (error.message?.includes("requested_provider_not_accepting_new_marketplace_work")) {
      throw new Error("requested_provider_not_marketplace_available");
    }
    throw error;
  }
}
