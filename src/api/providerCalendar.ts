import { supabase } from "../lib/supabase";

export type ProviderCalendarEvent = {
  provider_id: string;
  start_at: string;
  end_at: string;
  type: "booking" | "time_off" | "blocked" | "expected_recurring";
  booking_id: string | null;
  recurring_plan_id?: string | null;
  manual_block_id: string | null;
  time_off_id: string | null;
  status: string | null;
  service_type: string | null;
  price_cents: number | null;
  provider_payout_cents?: number | null;
  reason?: string | null;
};

type RecurringCalendarRow = {
  id: string;
  preferred_provider_id: string | null;
  current_booking_id: string | null;
  next_expected_at: string;
  service_type: string;
  cadence: "weekly" | "bi-weekly" | "monthly";
  status: "active" | "paused" | "ended";
};

function recurringExpectationStatus(plan: RecurringCalendarRow): string {
  if (plan.cadence === "weekly") return "waiting_confirmation";
  const windowDays = plan.cadence === "monthly" ? 14 : 7;
  const expectedAt = new Date(plan.next_expected_at).getTime();
  const opensAt = expectedAt - windowDays * 24 * 60 * 60 * 1000;
  return Date.now() >= opensAt ? "waiting_confirmation" : "expected";
}

export async function getProviderCalendarEvents(
  providerId: string,
  startISO: string,
  endISO: string
): Promise<ProviderCalendarEvent[]> {
  const [{ data, error }, recurringResult] = await Promise.all([
    supabase.rpc("get_provider_calendar_events_v1_1", {
      p_provider_id: providerId,
      p_start: startISO,
      p_end: endISO,
    }),
    supabase
      .from("recurring_cleaning_plans")
      .select("id,preferred_provider_id,current_booking_id,next_expected_at,service_type,cadence,status")
      .eq("preferred_provider_id", providerId)
      .eq("status", "active")
      .gte("next_expected_at", startISO)
      .lte("next_expected_at", endISO),
  ]);

  if (error) throw error;
  if (recurringResult.error) throw recurringResult.error;

  const baseEvents = (data ?? []) as ProviderCalendarEvent[];
  const bookingIds = baseEvents
    .filter((event) => event.type === "booking" && event.booking_id)
    .map((event) => event.booking_id as string);

  const payoutByBooking = new Map<string, number>();
  if (bookingIds.length > 0) {
    const { data: payoutRows, error: payoutError } = await supabase
      .from("bookings")
      .select("id,price_cents,platform_fee_cents")
      .eq("provider_id", providerId)
      .in("id", bookingIds);
    if (payoutError) throw payoutError;

    for (const row of payoutRows ?? []) {
      const price = Number(row.price_cents ?? 0);
      const fee = Number(row.platform_fee_cents ?? 0);
      payoutByBooking.set(row.id, Math.max(0, Math.round(price - fee)));
    }
  }

  const enrichedBase = baseEvents.map((event) => ({
    ...event,
    provider_payout_cents: event.booking_id ? payoutByBooking.get(event.booking_id) ?? null : null,
  }));

  const realBookingIds = new Set(bookingIds);
  const expectedEvents: ProviderCalendarEvent[] = ((recurringResult.data ?? []) as RecurringCalendarRow[])
    .filter((plan) => !plan.current_booking_id || !realBookingIds.has(plan.current_booking_id))
    .map((plan) => {
      const start = new Date(plan.next_expected_at);
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      return {
        provider_id: providerId,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        type: "expected_recurring",
        booking_id: null,
        recurring_plan_id: plan.id,
        manual_block_id: null,
        time_off_id: null,
        status: recurringExpectationStatus(plan),
        service_type: plan.service_type,
        price_cents: null,
        provider_payout_cents: null,
        reason: plan.cadence,
      };
    });

  return [...enrichedBase, ...expectedEvents]
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
}
