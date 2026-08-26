/**
 * Shared realtime pattern for booking updates.
 * All updates happen on one table: bookings.
 * Every state change emits a realtime event via Supabase Realtime.
 *
 * Event → UI reaction:
 * - matched   → Customer: provider card | Provider: job in JobQueue
 * - accepted  → Customer: "Provider accepted" | Provider: job moves to Home
 * - in_progress → Customer: live status | Provider: JobDetails active
 * - completed → Customer: receipt + rating | Provider: earnings update
 * - disputed  → Customer: dispute timeline | Provider: forced route to IncidentLog
 *
 * No polling. No refresh. No hacks.
 */

import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { Booking } from "../domain/booking";

export type BookingUpdateHandler = (booking: Booking) => void;

function mapRowToBooking(row: Record<string, unknown>): Booking {
  return {
    id: row.id as string,
    customer_id: (row.customer_id as string) ?? null,
    provider_id: (row.provider_id as string) || null,
    service_type: row.service_type as string,
    address: row.address as string,
    scheduled_start: row.scheduled_start as string,
    scheduled_end: (row.scheduled_end as string) || null,
    status: row.status as Booking["status"],
    price_cents: (row.price_cents as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/**
 * Subscribe to realtime updates for a single booking.
 * Call the returned function to unsubscribe.
 */
export function subscribeToBooking(
  bookingId: string,
  onUpdate: BookingUpdateHandler
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`booking-updates:${bookingId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "bookings",
        filter: `id=eq.${bookingId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (row && typeof row.id === "string") {
          onUpdate(mapRowToBooking(row));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
