import { supabase } from "./supabase";

export type ProviderTravelState = {
  enRouteAt: string | null;
  trackingActive: boolean;
  lastLocationAt: string | null;
  arrivedAt: string | null;
  distanceMeters: number | null;
  travelOpensAt: string | null;
  checkInOpensAt: string | null;
  travelWindowOpen: boolean;
  checkInWindowOpen: boolean;
};

function asTravelState(data: unknown): ProviderTravelState {
  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const distance = row.distance_meters;
  return {
    enRouteAt: typeof row.en_route_at === "string" ? row.en_route_at : null,
    arrivedAt: typeof row.arrived_at === "string" ? row.arrived_at : null,
    trackingActive: row.tracking_active === true,
    lastLocationAt: typeof row.last_location_at === "string" ? row.last_location_at : null,
    distanceMeters: typeof distance === "number" && Number.isFinite(distance) ? distance : null,
    travelOpensAt: typeof row.travel_opens_at === "string" ? row.travel_opens_at : null,
    checkInOpensAt: typeof row.check_in_opens_at === "string" ? row.check_in_opens_at : null,
    travelWindowOpen: row.travel_window_open === true,
    checkInWindowOpen: row.check_in_window_open === true,
  };
}

export function providerRpcErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object") {
    const row = error as Record<string, unknown>;
    const parts = [row.message, row.details, row.hint, row.code]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (parts.length > 0) return parts.join(" · ");
  }
  return String(error ?? "");
}

export async function getProviderTravelState(bookingId: string): Promise<ProviderTravelState> {
  const { data, error } = await supabase.rpc("get_my_provider_travel_state", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  return asTravelState(data);
}

export async function markProviderEnRoute(
  bookingId: string,
  lat: number,
  lon: number
): Promise<ProviderTravelState> {
  const { data, error } = await supabase.rpc("mark_booking_en_route_as_provider", {
    p_booking_id: bookingId,
    p_lat: lat,
    p_lon: lon,
  });
  if (error) throw error;
  return asTravelState(data);
}

export async function recordProviderTravelLocation(
  bookingId: string,
  lat: number,
  lon: number
): Promise<ProviderTravelState> {
  const { data, error } = await supabase.rpc("record_provider_travel_location_as_provider", {
    p_booking_id: bookingId,
    p_lat: lat,
    p_lon: lon,
  });
  if (error) throw error;
  return asTravelState(data);
}
