import type { BookingRescheduleRequest } from "@/domain/bookingReschedule";
import { isOfflinePreviewMode, supabase } from "@/lib/supabase";
import { dormantFeatureError, isSupabaseFeatureUnavailable } from "@/lib/supabaseFeature";

type BookingRescheduleRequestRow = {
  id: string;
  booking_id: string;
  customer_id: string;
  provider_id: string;
  requested_by: string;
  original_start: string;
  original_end: string | null;
  proposed_start: string;
  proposed_end: string;
  note: string | null;
  status: BookingRescheduleRequest["status"];
  responded_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

const RESCHEDULE_SELECT =
  "id,booking_id,customer_id,provider_id,requested_by,original_start,original_end,proposed_start,proposed_end,note,status,responded_by,resolved_at,created_at,updated_at";

function mapBookingRescheduleRequest(row: BookingRescheduleRequestRow): BookingRescheduleRequest {
  return {
    id: row.id,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    providerId: row.provider_id,
    requestedBy: row.requested_by,
    originalStart: row.original_start,
    originalEnd: row.original_end,
    proposedStart: row.proposed_start,
    proposedEnd: row.proposed_end,
    note: row.note,
    status: row.status,
    respondedBy: row.responded_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getPendingBookingReschedule(
  bookingId: string
): Promise<BookingRescheduleRequest | null> {
  if (isOfflinePreviewMode) return null;

  const { data, error } = await supabase
    .from("booking_reschedule_requests")
    .select(RESCHEDULE_SELECT)
    .eq("booking_id", bookingId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (isSupabaseFeatureUnavailable(error)) return null;
  if (error) throw error;
  return data ? mapBookingRescheduleRequest(data as BookingRescheduleRequestRow) : null;
}

export async function proposeBookingReschedule(input: {
  bookingId: string;
  proposedStart: string;
  proposedEnd?: string | null;
  note?: string | null;
}): Promise<BookingRescheduleRequest> {
  if (isOfflinePreviewMode) {
    throw new Error("Mutual rescheduling is unavailable in offline preview mode.");
  }

  const { data, error } = await supabase.rpc("propose_booking_reschedule", {
    p_booking_id: input.bookingId,
    p_proposed_start: input.proposedStart,
    p_proposed_end: input.proposedEnd ?? null,
    p_note: input.note?.trim() || null,
  });

  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Mutual rescheduling");
  if (error) throw error;
  return mapBookingRescheduleRequest(data as BookingRescheduleRequestRow);
}

export async function respondToBookingReschedule(
  requestId: string,
  response: "accept" | "decline" | "cancel"
): Promise<BookingRescheduleRequest> {
  if (isOfflinePreviewMode) {
    throw new Error("Mutual rescheduling is unavailable in offline preview mode.");
  }

  const { data, error } = await supabase.rpc("respond_to_booking_reschedule", {
    p_request_id: requestId,
    p_response: response,
  });

  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Mutual rescheduling");
  if (error) throw error;
  return mapBookingRescheduleRequest(data as BookingRescheduleRequestRow);
}
