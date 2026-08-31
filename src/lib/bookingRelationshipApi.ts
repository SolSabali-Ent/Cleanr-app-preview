import { supabase } from "./supabase";

/**
 * Bind an authenticated customer's unpaid, unassigned booking intent to durable
 * service relationship context before checkout. This records what relationship
 * the transaction continues; it does not assign provider fulfillment.
 */
export async function setMyBookingServiceRelationshipContext(
  bookingId: string,
  serviceRelationshipId: string
): Promise<void> {
  const normalizedBookingId = bookingId.trim();
  const normalizedRelationshipId = serviceRelationshipId.trim();
  if (!normalizedBookingId || !normalizedRelationshipId) return;

  const { error } = await supabase.rpc("set_my_booking_service_relationship_context", {
    p_booking_id: normalizedBookingId,
    p_service_relationship_id: normalizedRelationshipId,
  });
  if (error) throw error;
}
