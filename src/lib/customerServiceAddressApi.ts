import { supabase } from "@/lib/supabase";

export type CustomerServiceAddress = {
  key: string;
  line1: string;
  line2: string | null;
  lastUsedAt: string;
};

type BookingAddressRow = {
  id: string;
  address: unknown;
  scheduled_start: string;
  stripe_payment_intent_id: string | null;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanStreet(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (["nw", "ne", "sw", "se", "n", "s", "e", "w"].includes(lower)) return lower.toUpperCase();
      if (/^\d+[a-z]?$/i.test(word)) return word.toUpperCase();
      return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join(" ");
}

function parseVerifiedAddress(value: unknown): { line1: string; line2: string | null; key: string } | null {
  if (!value || typeof value !== "object") return null;
  const address = value as Record<string, unknown>;

  if (text(address.location_precision) !== "verified_street_address") return null;

  const street = text(address.street);
  const unit = text(address.unit);
  const city = text(address.city);
  const state = text(address.state).toUpperCase();
  const zip = text(address.zip_code || address.zip);

  let line1 = street ? cleanStreet(street) : "";
  if (line1 && unit) line1 = `${line1}, Unit ${unit}`;

  const line2Parts = [city ? cleanStreet(city) : "", state, zip].filter(Boolean);
  const line2 = line2Parts.length ? `${line2Parts.slice(0, 2).join(", ")}${zip ? ` ${zip}` : ""}`.trim() : null;

  if (!line1) {
    const fallback = text(address.address);
    if (!fallback) return null;
    line1 = fallback;
  }

  const key = `${line1}|${line2 ?? ""}`.toLowerCase();
  return { line1, line2, key };
}

/**
 * Customer-only address summary derived from paid, verified bookings.
 * The UI receives only human-readable address lines and last-used time — never coordinates,
 * access instructions, pricing metadata, or the raw booking address JSON.
 */
export async function listMyVerifiedServiceAddresses(): Promise<CustomerServiceAddress[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return [];

  const { data, error } = await supabase
    .from("bookings")
    .select("id,address,scheduled_start,stripe_payment_intent_id")
    .eq("customer_id", user.id)
    .not("stripe_payment_intent_id", "is", null)
    .order("scheduled_start", { ascending: false })
    .limit(100);

  if (error) throw error;

  const deduped = new Map<string, CustomerServiceAddress>();
  for (const row of (data ?? []) as BookingAddressRow[]) {
    if (!row.stripe_payment_intent_id) continue;
    const parsed = parseVerifiedAddress(row.address);
    if (!parsed || deduped.has(parsed.key)) continue;

    deduped.set(parsed.key, {
      key: parsed.key,
      line1: parsed.line1,
      line2: parsed.line2,
      lastUsedAt: row.scheduled_start,
    });
  }

  return [...deduped.values()];
}
