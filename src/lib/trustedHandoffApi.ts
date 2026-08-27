import { isOfflinePreviewMode, supabase } from "@/lib/supabase";
import { dormantFeatureError, isSupabaseFeatureUnavailable } from "@/lib/supabaseFeature";
import type {
  TrustedServiceHandoff,
  TrustedServiceHandoffReason,
  TrustedServiceHandoffSummary,
} from "@/domain/trustedHandoff";

type TrustedServiceHandoffRow = {
  id: string;
  booking_id: string;
  customer_id: string;
  from_provider_id: string;
  to_provider_id: string;
  coverage_relationship_id: string;
  reason: TrustedServiceHandoffReason;
  reason_note: string | null;
  status: TrustedServiceHandoff["status"];
  source_confirmed_at: string;
  backup_accepted_at: string | null;
  customer_confirmed_at: string | null;
  activated_at: string | null;
  fulfillment_applied_at: string | null;
  declined_at: string | null;
  cancelled_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

const HANDOFF_SELECT = "id, booking_id, customer_id, from_provider_id, to_provider_id, coverage_relationship_id, reason, reason_note, status, source_confirmed_at, backup_accepted_at, customer_confirmed_at, activated_at, fulfillment_applied_at, declined_at, cancelled_at, completed_at, created_at, updated_at";

function mapHandoff(row: TrustedServiceHandoffRow): TrustedServiceHandoff {
  return {
    id: row.id,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    fromProviderId: row.from_provider_id,
    toProviderId: row.to_provider_id,
    coverageRelationshipId: row.coverage_relationship_id,
    reason: row.reason,
    reasonNote: row.reason_note,
    status: row.status,
    sourceConfirmedAt: row.source_confirmed_at,
    backupAcceptedAt: row.backup_accepted_at,
    customerConfirmedAt: row.customer_confirmed_at,
    activatedAt: row.activated_at,
    fulfillmentAppliedAt: row.fulfillment_applied_at,
    declinedAt: row.declined_at,
    cancelledAt: row.cancelled_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMyTrustedServiceHandoffs(): Promise<TrustedServiceHandoffSummary[]> {
  if (isOfflinePreviewMode) return [];

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const personId = authData.user?.id;
  if (!personId) return [];

  const { data, error } = await supabase
    .from("trusted_service_handoffs")
    .select(HANDOFF_SELECT)
    .or(`from_provider_id.eq.${personId},to_provider_id.eq.${personId}`)
    .order("updated_at", { ascending: false });

  if (isSupabaseFeatureUnavailable(error)) return [];
  if (error) throw error;

  return ((data ?? []) as TrustedServiceHandoffRow[]).map((row) => ({
    handoff: mapHandoff(row),
    viewerRole: row.from_provider_id === personId ? "from_provider" : "backup_provider",
  }));
}

export async function getTrustedServiceHandoffForBooking(bookingId: string): Promise<TrustedServiceHandoff | null> {
  if (isOfflinePreviewMode) return null;

  const { data, error } = await supabase
    .from("trusted_service_handoffs")
    .select(HANDOFF_SELECT)
    .eq("booking_id", bookingId)
    .in("status", ["proposed", "backup_accepted", "customer_confirmed", "active", "completed"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (isSupabaseFeatureUnavailable(error)) return null;
  if (error) throw error;
  return data ? mapHandoff(data as TrustedServiceHandoffRow) : null;
}

export async function proposeTrustedServiceHandoff(input: {
  bookingId: string;
  toProviderId: string;
  coverageRelationshipId: string;
  reason: TrustedServiceHandoffReason;
  reasonNote?: string | null;
}): Promise<TrustedServiceHandoff> {
  if (isOfflinePreviewMode) throw new Error("Trusted handoffs are unavailable in offline preview mode.");

  const { data, error } = await supabase.rpc("propose_trusted_service_handoff", {
    p_booking_id: input.bookingId,
    p_to_provider_id: input.toProviderId,
    p_coverage_relationship_id: input.coverageRelationshipId,
    p_reason: input.reason,
    p_reason_note: input.reasonNote?.trim() || null,
  });

  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Trusted coverage");
  if (error) throw error;
  return mapHandoff(data as TrustedServiceHandoffRow);
}

export async function respondToTrustedServiceHandoff(
  handoffId: string,
  response: "accept" | "decline" | "cancel"
): Promise<TrustedServiceHandoff> {
  if (isOfflinePreviewMode) throw new Error("Trusted handoff responses are unavailable in offline preview mode.");

  const { data, error } = await supabase.rpc("respond_to_trusted_service_handoff", {
    p_handoff_id: handoffId,
    p_response: response,
  });

  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Trusted coverage");
  if (error) throw error;
  return mapHandoff(data as TrustedServiceHandoffRow);
}
