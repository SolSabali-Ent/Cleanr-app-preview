import { supabase } from "./supabase";
import type { Booking, BookingStatus } from "../domain/booking";
import type { BookingState } from "../booking/bookingStore";
import { persistedServiceLabelForCreateBooking } from "./serviceCatalog";
import { normalizeBookingSchedule } from "./bookingSchedule";

export function bookingAccessFieldsFromRow(row: Record<string, unknown>) {
  return {
    access_notes: (row.access_notes as string | null | undefined) ?? null,
    gate_code: (row.gate_code as string | null | undefined) ?? null,
    parking_notes: (row.parking_notes as string | null | undefined) ?? null,
    entry_instructions: (row.entry_instructions as string | null | undefined) ?? null,
    pet_notes: (row.pet_notes as string | null | undefined) ?? null,
    surfaces_to_avoid: (row.surfaces_to_avoid as string | null | undefined) ?? null,
    customer_access_updated_at: (row.customer_access_updated_at as string | null | undefined) ?? null,
  };
}

const CLIENT_REF_KEY = "cleanr_booking_client_ref";
const LEGACY_CLIENT_REF_KEY = "cleanr_client_ref";
const BOOKING_SELECT_WITH_PROVIDER = `
  *,
  provider:provider_public_profiles(*)
`;

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
  frequency: BookingState["frequency"]
): "one-time" | "weekly" | "bi-weekly" | "monthly" {
  if (frequency === "weekly" || frequency === "bi-weekly" || frequency === "monthly") return frequency;
  return "one-time";
}

function buildPricingInputs(state: BookingState) {
  return {
    service_option_key: normalizedServiceOptionKey(state.serviceType),
    bedrooms: toNumberOrNull(state.homeDetails.bedrooms),
    bathrooms: toNumberOrNull(state.homeDetails.bathrooms),
    sqft: toNumberOrNull(state.homeDetails.sqft),
    frequency: normalizedFrequency(state.frequency),
    extras: normalizedExtras(state.extras),
  };
}

/** Booking-attempt correlation/idempotency key for this browser. */
export function getClientRef(): string {
  let ref =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(CLIENT_REF_KEY) || localStorage.getItem(LEGACY_CLIENT_REF_KEY)
      : null;
  if (!ref) {
    ref = crypto.randomUUID();
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(CLIENT_REF_KEY, ref);
      localStorage.setItem(LEGACY_CLIENT_REF_KEY, ref);
    }
  } else if (typeof localStorage !== "undefined") {
    localStorage.setItem(CLIENT_REF_KEY, ref);
    localStorage.setItem(LEGACY_CLIENT_REF_KEY, ref);
  }
  return ref;
}

function stateToRpcParams(state: BookingState, clientRef: string) {
  const normalizedSchedule = normalizeBookingSchedule(state.date, state.time);
  if (!normalizedSchedule) {
    console.error("[booking] Invalid date/time slot for create_booking_geo", {
      date: state.date,
      time: state.time,
    });
    throw new Error("Please select a valid arrival window before continuing to payment.");
  }
  const addressDisplay = state.zipcode ? `ZIP ${state.zipcode}` : "Address TBD";
  const pricingInputs = buildPricingInputs(state);
  return {
    p_client_ref: clientRef,
    p_customer_id: null as string | null,
    p_service_type: persistedServiceLabelForCreateBooking(state.serviceType),
    p_address: {
      address: addressDisplay,
      zip_code: state.zipcode ?? null,
      pricing_inputs: pricingInputs,
    } as Record<string, unknown>,
    p_scheduled_start: normalizedSchedule.scheduledStartIso,
    p_scheduled_end: normalizedSchedule.scheduledEndIso,
    // Server-side pricing authority lives in create-booking-checkout.
    p_price_cents: 0,
  };
}

function normalizeAddress(address: unknown): string {
  if (!address) return "Address TBD";
  if (typeof address === "string") return address;
  if (typeof address === "object") {
    const obj = address as Record<string, unknown>;
    const line = obj.address;
    if (typeof line === "string" && line.trim()) return line;
    const zip = obj.zip_code ?? obj.zip;
    if (typeof zip === "string" && zip.trim()) return `ZIP ${zip}`;
  }
  return "Address TBD";
}

/**
 * Creates the authenticated customer's booking intent through the DB boundary.
 * A reused booking-attempt client_ref returns the existing booking id.
 */
export async function createBooking(state: BookingState): Promise<string> {
  const clientRef = getClientRef();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .eq("client_ref", clientRef)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const {
    p_client_ref: clientRefParam,
    p_customer_id: _customerId,
    p_service_type: serviceType,
    p_address: addressJson,
    p_scheduled_start: scheduledStartIso,
    p_scheduled_end: scheduledEndIso,
    p_price_cents: priceCents,
  } = stateToRpcParams(state, clientRef);

  const { data, error } = await supabase.rpc("create_booking_geo", {
    p_client_ref: clientRefParam,
    p_customer_id: user?.id ?? null,
    p_service_type: serviceType,
    p_address: addressJson,
    p_scheduled_start: scheduledStartIso,
    p_scheduled_end: scheduledEndIso ?? null,
    p_price_cents: priceCents,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.startsWith("outside_service_area")) {
      throw new Error("Cleanr currently services Metro Atlanta only.");
    }
    throw error;
  }
  const bookingId = data as string;
  if (!bookingId) throw new Error("No id returned from create_booking_geo");
  return bookingId;
}

export async function createBookingCheckoutSession(bookingId: string): Promise<{ url: string }> {
  const clientRef = getClientRef();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const successUrl = `${origin}/booking-confirmed?bookingId=${encodeURIComponent(bookingId)}`;
  const cancelUrl = `${origin}/booking-confirmed?bookingId=${encodeURIComponent(bookingId)}&payment=cancelled`;
  const { data, error } = await supabase.functions.invoke("create-booking-checkout", {
    body: {
      booking_id: bookingId,
      client_ref: clientRef,
      success_url: successUrl,
      cancel_url: cancelUrl,
    },
  });
  if (error) throw error;
  const result = data as { url?: string } | null;
  if (!result?.url) throw new Error("No checkout URL returned");
  return { url: result.url };
}

/** Fetch bookings visible to the customer under current booking RLS. */
export async function listBookingsForCustomer(): Promise<Booking[]> {
  const { data: { user } } = await supabase.auth.getUser();
  const clientRef = typeof localStorage !== "undefined" ? localStorage.getItem(CLIENT_REF_KEY) : null;

  if (user) {
    const { data, error } = await supabase
      .from("bookings")
      .select(BOOKING_SELECT_WITH_PROVIDER)
      .eq("customer_id", user.id)
      .order("scheduled_start", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(rowToBooking);
  }

  if (clientRef) {
    const { data, error } = await supabase
      .from("bookings")
      .select(BOOKING_SELECT_WITH_PROVIDER)
      .is("customer_id", null)
      .eq("client_ref", clientRef)
      .order("scheduled_start", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(rowToBooking);
  }

  return [];
}

export async function getBooking(bookingId: string): Promise<Booking | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT_WITH_PROVIDER)
    .eq("id", bookingId)
    .single();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    id: row.id as string,
    customer_id: (row.customer_id as string) ?? null,
    provider_id: (row.provider_id as string) || null,
    service_type: row.service_type as string,
    address: normalizeAddress(row.address),
    scheduled_start: row.scheduled_start as string,
    scheduled_end: (row.scheduled_end as string) || null,
    status: row.status as BookingStatus,
    price_cents: (row.price_cents as number) ?? 0,
    stripe_payment_intent_id: (row.stripe_payment_intent_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    ...bookingAccessFieldsFromRow(row),
  } as Booking;
}

function rowToBooking(row: Record<string, unknown>): Booking {
  const providerRow =
    row.provider && typeof row.provider === "object"
      ? (row.provider as Record<string, unknown>)
      : null;

  return {
    id: row.id as string,
    customer_id: (row.customer_id as string) ?? null,
    provider_id: (row.provider_id as string) || null,
    service_type: row.service_type as string,
    address: normalizeAddress(row.address),
    scheduled_start: row.scheduled_start as string,
    scheduled_end: (row.scheduled_end as string) || null,
    status: row.status as BookingStatus,
    price_cents: (row.price_cents as number) ?? 0,
    stripe_payment_intent_id: (row.stripe_payment_intent_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    ...bookingAccessFieldsFromRow(row),
    provider: providerRow
      ? {
          id: String(providerRow.id ?? ""),
          full_name: (providerRow.full_name as string | null) ?? null,
          service_radius_miles: (providerRow.service_radius_miles as number | null) ?? null,
          marketplace_access: (providerRow.marketplace_access as boolean | null) ?? null,
          created_at: (providerRow.created_at as string | null) ?? null,
          background_checked: (providerRow.background_checked as boolean | null) ?? null,
          insured: (providerRow.insured as boolean | null) ?? null,
          platform_verified: (providerRow.platform_verified as boolean | null) ?? null,
        }
      : null,
  } as Booking;
}

export type AvailableJob = Booking & { distance_meters?: number };

/** DB-first provider job feed. Matching/eligibility authority lives in the RPC. */
export async function findAvailableJobsForProvider(
  p_provider_id: string,
  p_limit: number = 100
): Promise<AvailableJob[]> {
  const { data: providerProfile, error: profileError } = await supabase
    .from("profiles")
    .select("marketplace_access")
    .eq("id", p_provider_id)
    .maybeSingle();
  if (profileError) {
    throw profileError;
  }
  if (!providerProfile?.marketplace_access) {
    return [];
  }

  const { data, error } = await supabase.rpc("find_available_jobs_for_provider", {
    p_provider_id,
    p_limit,
  });
  if (error) {
    if (error.message?.toLowerCase().includes("unauthorized")) {
      return [];
    }
    throw error;
  }
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    ...rowToBooking(row),
    distance_meters: row.distance_meters as number | undefined,
  }));
}

export async function listMyJobsAsProvider(): Promise<Booking[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("provider_id", user.id)
    .in("status", ["accepted", "in_progress", "completed_by_provider", "confirmed", "disputed"])
    .order("scheduled_start", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToBooking);
}

export type ProviderEarningsBookingRow = {
  id: string;
  status: string;
  service_type: string;
  scheduled_start: string;
  scheduled_end: string | null;
  price_cents: number;
  platform_fee_cents: number | null;
  payout_released_at: string | null;
  stripe_transfer_id: string | null;
  customer_id: string | null;
  address: unknown;
  updated_at: string;
  created_at: string;
  zip_code: string | null;
};

const PROVIDER_EARNINGS_SELECT =
  "id,status,service_type,scheduled_start,scheduled_end,price_cents,platform_fee_cents,payout_released_at,stripe_transfer_id,customer_id,address,updated_at,created_at,zip_code";

function toInt(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function rowToProviderEarningsBooking(row: Record<string, unknown>): ProviderEarningsBookingRow {
  return {
    id: String(row.id ?? ""),
    status: String(row.status ?? ""),
    service_type: String(row.service_type ?? ""),
    scheduled_start: String(row.scheduled_start ?? ""),
    scheduled_end: (row.scheduled_end as string | null) ?? null,
    price_cents: toInt(row.price_cents),
    platform_fee_cents: row.platform_fee_cents == null ? null : toInt(row.platform_fee_cents),
    payout_released_at: (row.payout_released_at as string | null) ?? null,
    stripe_transfer_id: (row.stripe_transfer_id as string | null) ?? null,
    customer_id: (row.customer_id as string | null) ?? null,
    address: row.address,
    updated_at: String(row.updated_at ?? ""),
    created_at: String(row.created_at ?? ""),
    zip_code: (row.zip_code as string | null) ?? null,
  };
}

export async function listProviderEarningsBookings(): Promise<ProviderEarningsBookingRow[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select(PROVIDER_EARNINGS_SELECT)
    .eq("provider_id", user.id)
    .order("scheduled_start", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToProviderEarningsBooking);
}

export function providerEarningCentsFromRow(row: ProviderEarningsBookingRow): number {
  return row.price_cents - (row.platform_fee_cents ?? 0);
}

export function isProviderPendingEarning(row: ProviderEarningsBookingRow): boolean {
  const st = row.status;
  if (st !== "completed_by_provider" && st !== "completed") return false;
  if (row.payout_released_at != null) return false;
  const tid = row.stripe_transfer_id;
  if (tid != null && String(tid).trim() !== "") return false;
  return true;
}

export function isProviderPaidEarning(row: ProviderEarningsBookingRow): boolean {
  if (row.payout_released_at != null) return true;
  const tid = row.stripe_transfer_id;
  return tid != null && String(tid).trim() !== "";
}

export async function acceptBookingAsProvider(bookingId: string): Promise<Booking> {
  const { data, error } = await supabase.rpc("accept_booking_as_provider", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  if (!data) throw new Error("No booking returned");
  return rowToBooking(data as Record<string, unknown>);
}

export async function startBookingAsProvider(bookingId: string): Promise<Booking> {
  const { data, error } = await supabase.rpc("start_booking_as_provider", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  if (!data) throw new Error("No booking returned");
  return rowToBooking(data as Record<string, unknown>);
}

export async function completeBookingAsProvider(bookingId: string): Promise<Booking> {
  const { data, error } = await supabase.rpc("complete_booking_as_provider", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  if (!data) throw new Error("No booking returned");
  return rowToBooking(data as Record<string, unknown>);
}

export async function checkInBookingAsProvider(
  bookingId: string,
  lat: number,
  lon: number
): Promise<Booking> {
  const { data, error } = await supabase.rpc("check_in_booking_as_provider", {
    p_booking_id: bookingId,
    p_lat: lat,
    p_lon: lon,
  });
  if (error) throw error;
  if (!data) throw new Error("No booking returned");
  return rowToBooking(data as Record<string, unknown>);
}

export async function checkOutBookingAsProvider(
  bookingId: string,
  lat: number,
  lon: number
): Promise<Booking> {
  const { data, error } = await supabase.rpc("check_out_booking_as_provider", {
    p_booking_id: bookingId,
    p_lat: lat,
    p_lon: lon,
  });
  if (error) throw error;
  if (!data) throw new Error("No booking returned");
  return rowToBooking(data as Record<string, unknown>);
}
