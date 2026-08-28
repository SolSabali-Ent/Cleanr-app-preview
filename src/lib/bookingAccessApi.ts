import { supabase } from "./supabase";

export type CustomerBookingAccessPatch = {
  access_notes?: string | null;
  gate_code?: string | null;
  parking_notes?: string | null;
  entry_instructions?: string | null;
  pet_notes?: string | null;
  surfaces_to_avoid?: string | null;
};

/**
 * Update customer-owned visit details through the bounded booking RPC.
 * Assignment, pricing, payment, status, and fulfillment fields are not client-writable here.
 */
export async function updateCustomerBookingAccess(
  bookingId: string,
  patch: CustomerBookingAccessPatch
): Promise<void> {
  const { error } = await supabase.rpc("update_my_booking_access", {
    p_booking_id: bookingId,
    p_access_notes: patch.access_notes ?? null,
    p_gate_code: patch.gate_code ?? null,
    p_parking_notes: patch.parking_notes ?? null,
    p_entry_instructions: patch.entry_instructions ?? null,
    p_pet_notes: patch.pet_notes ?? null,
    p_surfaces_to_avoid: patch.surfaces_to_avoid ?? null,
  });

  if (error) throw error;
}
