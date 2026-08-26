import { supabase } from "./supabase";

export type WaitlistLeadSource = "zip_activation_gate" | "marketing_entry" | "provider_presence";
export type WaitlistActivationReason =
  | "unsupported_zip"
  | "provider_supply_building"
  | "market_not_active";

export type CreateWaitlistLeadInput = {
  zip: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  source: WaitlistLeadSource;
  activationReason: WaitlistActivationReason;
  serviceable: boolean;
  activeProviderCount?: number | null;
};

function normalizeZip(zip: string): string {
  return zip.trim();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}

function isValidEmail(email: string): boolean {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
}

export async function createWaitlistLead(input: CreateWaitlistLeadInput): Promise<void> {
  const zip = normalizeZip(input.zip);
  const email = normalizeEmail(input.email);

  if (!isValidZip(zip)) {
    throw new Error("Please enter a valid 5-digit ZIP code.");
  }
  if (!isValidEmail(email)) {
    throw new Error("Please enter a valid email address.");
  }

  const { error } = await supabase.from("customer_waitlist_leads").upsert(
    {
      zip,
      email,
      name: input.name?.trim() || null,
      phone: input.phone?.trim() || null,
      source: input.source,
      activation_reason: input.activationReason,
      serviceable: input.serviceable,
      active_provider_count:
        typeof input.activeProviderCount === "number" ? Math.max(0, Math.round(input.activeProviderCount)) : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email,zip,source", ignoreDuplicates: false }
  );

  if (error) {
    throw new Error("Unable to save early access request.");
  }
}
