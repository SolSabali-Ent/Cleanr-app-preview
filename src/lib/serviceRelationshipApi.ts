import type { Booking } from "@/domain/booking";
import type { ProviderHouseholdRelationshipSummary, ServiceRelationship } from "@/domain/serviceRelationship";
import { listMyJobsAsProvider } from "@/lib/bookingApi";
import { isOfflinePreviewMode, supabase } from "@/lib/supabase";

const COMPLETED_STATUSES = new Set<Booking["status"]>(["completed_by_provider", "confirmed"]);
const ACTIVE_STATUSES = new Set<Booking["status"]>(["accepted", "in_progress"]);

type ServiceRelationshipRow = {
  id: string;
  customer_id: string;
  provider_id: string;
  relationship_kind: ServiceRelationship["kind"];
  status: ServiceRelationship["status"];
  origin: ServiceRelationship["origin"];
  customer_preferred: boolean;
  preferred_at: string | null;
  first_booking_id: string | null;
  latest_booking_id: string | null;
  completed_services_count: number;
  first_served_at: string | null;
  last_served_at: string | null;
  next_scheduled_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapServiceRelationship(row: ServiceRelationshipRow): ServiceRelationship {
  return {
    id: row.id,
    customerId: row.customer_id,
    providerId: row.provider_id,
    kind: row.relationship_kind,
    status: row.status,
    origin: row.origin,
    customerPreferred: row.customer_preferred,
    preferredAt: row.preferred_at,
    firstBookingId: row.first_booking_id,
    latestBookingId: row.latest_booking_id,
    completedServicesCount: row.completed_services_count,
    firstServedAt: row.first_served_at,
    lastServedAt: row.last_served_at,
    nextScheduledAt: row.next_scheduled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Transitional relationship summary derived only from existing booking truth.
 *
 * This intentionally does not query the future service_relationships table yet, so the current
 * app remains compatible until the dormant migration is applied. Once durable relationship state
 * is live, this function can reconcile booking evidence into that table instead of redefining jobs.
 */
export async function listMyHouseholdContinuity(): Promise<ProviderHouseholdRelationshipSummary[]> {
  const bookings = await listMyJobsAsProvider();
  const byCustomer = new Map<string, Booking[]>();

  for (const booking of bookings) {
    const customerId = booking.customer_id?.trim();
    if (!customerId) continue;
    const current = byCustomer.get(customerId) ?? [];
    current.push(booking);
    byCustomer.set(customerId, current);
  }

  const now = Date.now();
  return Array.from(byCustomer.entries())
    .map(([customerId, customerBookings]) => {
      const completed = customerBookings.filter((booking) => COMPLETED_STATUSES.has(booking.status));
      const scheduled = customerBookings
        .filter((booking) => ACTIVE_STATUSES.has(booking.status))
        .map((booking) => dateOrNull(booking.scheduled_start))
        .filter((date): date is Date => Boolean(date))
        .filter((date) => date.getTime() >= now)
        .sort((a, b) => a.getTime() - b.getTime());
      const servedDates = completed
        .map((booking) => dateOrNull(booking.scheduled_start))
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => a.getTime() - b.getTime());

      return {
        customerId,
        householdLabel: "Cleanr household",
        relationship: null,
        completedServicesCount: completed.length,
        firstServedAt: servedDates[0]?.toISOString() ?? null,
        lastServedAt: servedDates.at(-1)?.toISOString() ?? null,
        nextScheduledAt: scheduled[0]?.toISOString() ?? null,
        source: "booking_history" as const,
      };
    })
    .sort((a, b) => {
      const aTime = dateOrNull(a.nextScheduledAt)?.getTime() ?? dateOrNull(a.lastServedAt)?.getTime() ?? 0;
      const bTime = dateOrNull(b.nextScheduledAt)?.getTime() ?? dateOrNull(b.lastServedAt)?.getTime() ?? 0;
      return bTime - aTime;
    });
}

export async function getMyServiceRelationshipWithProvider(providerId: string): Promise<ServiceRelationship | null> {
  if (isOfflinePreviewMode) return null;

  const { data, error } = await supabase
    .from("service_relationships")
    .select("id, customer_id, provider_id, relationship_kind, status, origin, customer_preferred, preferred_at, first_booking_id, latest_booking_id, completed_services_count, first_served_at, last_served_at, next_scheduled_at, created_at, updated_at")
    .eq("provider_id", providerId)
    .in("status", ["active", "paused"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? mapServiceRelationship(data as ServiceRelationshipRow) : null;
}

export async function setMyPreferredServiceProvider(providerId: string, preferred: boolean): Promise<ServiceRelationship> {
  if (isOfflinePreviewMode) {
    throw new Error("Provider preference is unavailable in offline preview mode.");
  }

  const { data, error } = await supabase.rpc("set_my_preferred_service_provider", {
    p_provider_id: providerId,
    p_preferred: preferred,
  });

  if (error) throw error;
  return mapServiceRelationship(data as ServiceRelationshipRow);
}
