import { supabase } from "./supabase";

export type ProviderEarningsBookingRow = {
  id: string;
  status: string;
  service_type: string;
  scheduled_start: string;
  scheduled_end: string | null;
  price_cents: number;
  platform_fee_cents: number | null;
  payout_released: boolean;
  payout_released_at: string | null;
  payout_reversed_at: string | null;
  stripe_transfer_id: string | null;
  customer_id: string | null;
  address: unknown;
  updated_at: string;
  created_at: string;
  zip_code: string | null;
};

const PROVIDER_EARNINGS_SELECT =
  "id,status,service_type,scheduled_start,scheduled_end,price_cents,platform_fee_cents,payout_released,payout_released_at,payout_reversed_at,stripe_transfer_id,customer_id,address,updated_at,created_at,zip_code";

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
    payout_released: row.payout_released === true,
    payout_released_at: (row.payout_released_at as string | null) ?? null,
    payout_reversed_at: (row.payout_reversed_at as string | null) ?? null,
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
  if (!["completed_by_provider", "confirmed", "completed"].includes(row.status)) return false;
  return row.payout_released !== true;
}

export function isProviderPaidEarning(row: ProviderEarningsBookingRow): boolean {
  return row.payout_released === true;
}
