import type { BookingState } from "../booking/bookingStore";
import { normalizeBookingSchedule } from "./bookingSchedule";
import { getClientRef } from "./bookingApi";
import { persistedServiceLabelForCreateBooking } from "./serviceCatalog";
import { supabase } from "./supabase";

function toNumberOrNull(input: string | null | undefined): number | null {
  if (!input) return null;
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

function normalizedServiceOptionKey(serviceType: string | null): "standard" | "deep" | "moveout" {
  const normalized = (serviceType ?? "").trim().toLowerCase();
  if (normalized.includes("deep")) return "deep";
  if (normalized.includes("move")) return "moveout";
  return "standard";
}

function normalizedExtras(extras: string[]): string[] {
  return extras
    .map((extra) => extra.trim().toLowerCase())
    .filter(Boolean)
    .map((extra) => {
      if (extra.includes("fridge")) return "fridge";
      if (extra.includes("oven")) return "oven";
      if (extra.includes("laundry")) return "laundry";
      if (extra.includes("window")) return "windows";
      if (extra.includes("baseboard")) return "baseboards";
      if (extra.includes("deep")) return "deepclean";
      return extra;
    });
}

function normalizedFrequency(
  frequency: BookingState["frequency"],
): "one-time" | "weekly" | "bi-weekly" | "monthly" {
  if (frequency === "weekly" || frequency === "bi-weekly" || frequency === "monthly") return frequency;
  return "one-time";
}

export async function createVerifiedBooking(state: BookingState): Promise<string> {
  const address = state.serviceAddress;
  if (
    !address.verified ||
    !address.formatted.trim() ||
    typeof address.lat !== "number" ||
    typeof address.lng !== "number" ||
    !address.zip.trim()
  ) {
    throw new Error("A verified service address is required before payment.");
  }

  const normalizedSchedule = normalizeBookingSchedule(state.date, state.time);
  if (!normalizedSchedule) {
    throw new Error("Please select a valid arrival window before continuing to payment.");
  }

  const clientRef = getClientRef();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Please sign in before payment so we can confirm your booking identity.");

  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("client_ref", clientRef)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const pricingInputs = {
    service_option_key: normalizedServiceOptionKey(state.serviceType),
    bedrooms: toNumberOrNull(state.homeDetails.bedrooms),
    bathrooms: toNumberOrNull(state.homeDetails.bathrooms),
    sqft: toNumberOrNull(state.homeDetails.sqft),
    frequency: normalizedFrequency(state.frequency),
    extras: normalizedExtras(state.extras),
  };

  const { data, error } = await supabase.rpc("create_booking_geo", {
    p_client_ref: clientRef,
    p_customer_id: user.id,
    p_service_type: persistedServiceLabelForCreateBooking(state.serviceType),
    p_address: {
      address: address.formatted,
      street: address.street,
      unit: address.unit || null,
      city: address.city,
      state: address.state,
      zip_code: address.zip,
      lat: address.lat,
      lng: address.lng,
      location_precision: "verified_street_address",
      pricing_inputs: pricingInputs,
    },
    p_scheduled_start: normalizedSchedule.scheduledStartIso,
    p_scheduled_end: normalizedSchedule.scheduledEndIso ?? null,
    p_price_cents: 0,
  });

  if (error) {
    if (error.message?.includes("verified_service_address_required")) {
      throw new Error("A verified service address is required before payment.");
    }
    throw error;
  }

  const bookingId = data as string | null;
  if (!bookingId) throw new Error("No booking id returned.");
  return bookingId;
}
