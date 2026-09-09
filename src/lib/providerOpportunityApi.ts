import { supabase } from "./supabase";

export type ProviderOpportunity = {
  id: string;
  serviceType: string;
  serviceArea: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  customerTotalCents: number;
  platformFeeCents: number;
  expectedEarningsCents: number;
  distanceMeters: number | null;
  requestedForMe: boolean;
};

function serviceAreaFromAddress(address: unknown): string {
  if (!address || typeof address !== "object") return "Service area unavailable";
  const row = address as Record<string, unknown>;
  const zip = row.zip_code ?? row.zip;
  return typeof zip === "string" && zip.trim() ? `ZIP ${zip.trim()}` : "Service area unavailable";
}

export async function getMyProviderOpportunity(bookingId: string): Promise<ProviderOpportunity | null> {
  const { data, error } = await supabase.rpc("get_my_provider_opportunity", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  if (!data || typeof data !== "object") return null;

  const row = data as Record<string, unknown>;
  const customerTotalCents = Number(row.price_cents ?? 0);
  const platformFeeCents = Number(row.platform_fee_cents ?? 0);
  return {
    id: String(row.id ?? ""),
    serviceType: String(row.service_type ?? "Residential cleaning"),
    serviceArea: serviceAreaFromAddress(row.address),
    scheduledStart: String(row.scheduled_start ?? ""),
    scheduledEnd: row.scheduled_end == null ? null : String(row.scheduled_end),
    customerTotalCents: Number.isFinite(customerTotalCents) ? customerTotalCents : 0,
    platformFeeCents: Number.isFinite(platformFeeCents) ? platformFeeCents : 0,
    expectedEarningsCents: Math.max(0, (Number.isFinite(customerTotalCents) ? customerTotalCents : 0) - (Number.isFinite(platformFeeCents) ? platformFeeCents : 0)),
    distanceMeters: row.distance_meters == null ? null : Number(row.distance_meters),
    requestedForMe: row.requested_for_me === true,
  };
}

export async function getMyNewMarketplaceIntake(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return true;
  const { data, error } = await supabase
    .from("provider_preferences")
    .select("accepts_new_marketplace_work")
    .eq("provider_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data?.accepts_new_marketplace_work !== false;
}
