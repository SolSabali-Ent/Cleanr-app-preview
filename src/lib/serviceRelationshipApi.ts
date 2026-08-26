import type { Booking } from "@/domain/booking";
import type { ProviderHouseholdRelationshipSummary } from "@/domain/serviceRelationship";
import { listMyJobsAsProvider } from "@/lib/bookingApi";

const COMPLETED_STATUSES = new Set<Booking["status"]>(["completed_by_provider", "confirmed"]);
const ACTIVE_STATUSES = new Set<Booking["status"]>(["accepted", "in_progress"]);

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
