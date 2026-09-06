import type { Booking } from "../domain/booking";
import { supabase } from "./supabase";

export type ProviderDepartureResult = {
  completed: boolean;
  distanceMeters: number | null;
  departureThresholdMeters: number | null;
  booking: Booking | null;
};

function normalizeAddress(address: unknown): string {
  if (typeof address === "string" && address.trim()) return address.trim();
  if (address && typeof address === "object") {
    const row = address as Record<string, unknown>;
    if (typeof row.address === "string" && row.address.trim()) return row.address.trim();
    const zip = row.zip_code ?? row.zip;
    if (typeof zip === "string" && zip.trim()) return `ZIP ${zip.trim()}`;
  }
  return "Address unavailable";
}

function asBooking(data: unknown): Booking {
  if (!data || typeof data !== "object") throw new Error("No booking returned");
  const row = data as Record<string, unknown>;
  return {
    ...row,
    address: normalizeAddress(row.address),
  } as unknown as Booking;
}

export async function finishProviderService(
  bookingId: string,
  lat: number,
  lon: number
): Promise<Booking> {
  const { data, error } = await supabase.rpc("finish_service_as_provider", {
    p_booking_id: bookingId,
    p_lat: lat,
    p_lon: lon,
  });
  if (error) throw error;
  return asBooking(data);
}

export async function verifyProviderDeparture(
  bookingId: string,
  lat: number,
  lon: number
): Promise<ProviderDepartureResult> {
  const { data, error } = await supabase.rpc("verify_provider_departure_as_provider", {
    p_booking_id: bookingId,
    p_lat: lat,
    p_lon: lon,
  });
  if (error) throw error;

  const row = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const distance = Number(row.distance_meters);
  const threshold = Number(row.departure_threshold_meters);
  return {
    completed: row.completed === true,
    distanceMeters: Number.isFinite(distance) ? distance : null,
    departureThresholdMeters: Number.isFinite(threshold) ? threshold : null,
    booking: row.booking && typeof row.booking === "object" ? asBooking(row.booking) : null,
  };
}
