import { supabase } from "../lib/supabase";

export type ProviderCalendarEvent = {
  provider_id: string;
  start_at: string;
  end_at: string;
  type: "booking" | "time_off" | "blocked";
  booking_id: string | null;
  manual_block_id: string | null;
  time_off_id: string | null;
  status: string | null;
  service_type: string | null;
  price_cents: number | null;
  reason?: string | null;
};

export async function getProviderCalendarEvents(
  providerId: string,
  startISO: string,
  endISO: string
): Promise<ProviderCalendarEvent[]> {
  const { data, error } = await supabase.rpc("get_provider_calendar_events_v1_1", {
    p_provider_id: providerId,
    p_start: startISO,
    p_end: endISO,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProviderCalendarEvent[];
}
