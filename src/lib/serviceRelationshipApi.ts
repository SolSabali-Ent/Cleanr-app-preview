import type { Booking } from "@/domain/booking";
import type { ProviderHouseholdRelationshipSummary, ServiceRelationship } from "@/domain/serviceRelationship";
import { listMyJobsAsProvider } from "@/lib/bookingApi";
import { isOfflinePreviewMode, supabase } from "@/lib/supabase";
import { dormantFeatureError, isSupabaseFeatureUnavailable } from "@/lib/supabaseFeature";

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

const SERVICE_RELATIONSHIP_SELECT =
  "id, customer_id, provider_id, relationship_kind, status, origin, customer_preferred, preferred_at, first_booking_id, latest_booking_id, completed_services_count, first_served_at, last_served_at, next_scheduled_at, created_at, updated_at";

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

function bookingHistorySummaries(bookings: Booking[]): ProviderHouseholdRelationshipSummary[] {
  const byCustomer = new Map<string, Booking[]>();

  for (const booking of bookings) {
    const customerId = booking.customer_id?.trim();
    if (!customerId) continue;
    const current = byCustomer.get(customerId) ?? [];
    current.push(booking);
    byCustomer.set(customerId, current);
  }

  const now = Date.now();
  return Array.from(byCustomer.entries()).map(([customerId, customerBookings]) => {
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
  });
}

function continuitySortTime(summary: ProviderHouseholdRelationshipSummary): number {
  return dateOrNull(summary.nextScheduledAt)?.getTime() ?? dateOrNull(summary.lastServedAt)?.getTime() ?? 0;
}

export async function listMyHouseholdContinuity(): Promise<ProviderHouseholdRelationshipSummary[]> {
  const bookings = await listMyJobsAsProvider();
  const fallbackSummaries = bookingHistorySummaries(bookings);

  if (isOfflinePreviewMode) {
    return fallbackSummaries.sort((a, b) => continuitySortTime(b) - continuitySortTime(a));
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const providerId = session?.user?.id;
  if (!providerId) return fallbackSummaries.sort((a, b) => continuitySortTime(b) - continuitySortTime(a));

  const { data, error } = await supabase
    .from("service_relationships")
    .select(SERVICE_RELATIONSHIP_SELECT)
    .eq("provider_id", providerId)
    .in("status", ["active", "paused"])
    .order("updated_at", { ascending: false });

  if (isSupabaseFeatureUnavailable(error)) {
    return fallbackSummaries.sort((a, b) => continuitySortTime(b) - continuitySortTime(a));
  }
  if (error) throw error;

  const durableByCustomer = new Map<string, ProviderHouseholdRelationshipSummary>();
  for (const row of (data ?? []) as ServiceRelationshipRow[]) {
    if (durableByCustomer.has(row.customer_id)) continue;
    const relationship = mapServiceRelationship(row);
    durableByCustomer.set(row.customer_id, {
      customerId: relationship.customerId,
      householdLabel: "Cleanr household",
      relationship,
      completedServicesCount: relationship.completedServicesCount,
      firstServedAt: relationship.firstServedAt ?? null,
      lastServedAt: relationship.lastServedAt ?? null,
      nextScheduledAt: relationship.nextScheduledAt ?? null,
      source: "durable_relationship",
    });
  }

  for (const fallback of fallbackSummaries) {
    if (!durableByCustomer.has(fallback.customerId)) {
      durableByCustomer.set(fallback.customerId, fallback);
    }
  }

  return Array.from(durableByCustomer.values()).sort(
    (a, b) => continuitySortTime(b) - continuitySortTime(a)
  );
}

export async function getMyHouseholdContinuityForCustomer(customerId: string): Promise<ProviderHouseholdRelationshipSummary | null> {
  const normalizedCustomerId = customerId.trim();
  if (!normalizedCustomerId) return null;
  const households = await listMyHouseholdContinuity();
  return households.find((household) => household.customerId === normalizedCustomerId) ?? null;
}

export async function getMyServiceRelationshipWithProvider(providerId: string): Promise<ServiceRelationship | null> {
  if (isOfflinePreviewMode) return null;

  const { data, error } = await supabase
    .from("service_relationships")
    .select(SERVICE_RELATIONSHIP_SELECT)
    .eq("provider_id", providerId)
    .in("status", ["active", "paused"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (isSupabaseFeatureUnavailable(error)) return null;
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

  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Preferred CSP continuity");
  if (error) throw error;
  return mapServiceRelationship(data as ServiceRelationshipRow);
}
