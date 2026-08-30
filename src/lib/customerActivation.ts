import { supabase } from "./supabase";
import { getProviderPresenceSummary } from "./providerPresence";

export type CustomerActivationReason =
  | "active"
  | "unsupported_zip"
  | "provider_supply_building"
  | "disabled_by_config"
  | "unknown";

export type CustomerActivationStatus = {
  zip: string;
  serviceable: boolean;
  activeProviderCount: number;
  bookingEnabled: boolean;
  reason: CustomerActivationReason;
};

function parseBooleanEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function parseMinProviderThreshold(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.round(parsed);
}

function parseZipOverrideAllowlist(value: string | undefined): Set<string> {
  if (!value) return new Set<string>();
  return new Set(
    value
      .split(",")
      .map((part) => part.trim())
      .filter((part) => /^\d{5}$/.test(part))
  );
}

const MIN_ACTIVE_PROVIDERS_TO_ENABLE_CHECKOUT = parseMinProviderThreshold(
  import.meta.env.VITE_MIN_ACTIVE_PROVIDERS_TO_ENABLE_CHECKOUT
);
const CUSTOMER_CHECKOUT_ENABLED = parseBooleanEnv(import.meta.env.VITE_CUSTOMER_CHECKOUT_ENABLED, true);
const CHECKOUT_ENABLED_ZIP_OVERRIDES = parseZipOverrideAllowlist(
  import.meta.env.VITE_CHECKOUT_ENABLED_ZIPS
);

/**
 * Provider-first activation gate for customer checkout.
 * Serviceable ZIP alone is not enough; booking enablement also requires market activation.
 */
export async function getCustomerActivationStatus(zip: string): Promise<CustomerActivationStatus> {
  const normalizedZip = zip.trim();
  if (!/^\d{5}$/.test(normalizedZip)) {
    return {
      zip: normalizedZip,
      serviceable: false,
      activeProviderCount: 0,
      bookingEnabled: false,
      reason: "unsupported_zip",
    };
  }

  const { data: serviceableData, error: serviceableError } = await supabase.rpc("validate_service_zip", {
    p_zip: normalizedZip,
  });
  if (serviceableError) {
    return {
      zip: normalizedZip,
      serviceable: false,
      activeProviderCount: 0,
      bookingEnabled: false,
      reason: "unknown",
    };
  }
  if (serviceableData == null) {
    return {
      zip: normalizedZip,
      serviceable: false,
      activeProviderCount: 0,
      bookingEnabled: false,
      reason: "unsupported_zip",
    };
  }
  if (typeof serviceableData !== "object" || Array.isArray(serviceableData)) {
    return {
      zip: normalizedZip,
      serviceable: false,
      activeProviderCount: 0,
      bookingEnabled: false,
      reason: "unknown",
    };
  }

  const presence = await getProviderPresenceSummary({ zip: normalizedZip, sampleLimit: 0 });
  const activeProviderCount = presence.active_provider_count ?? 0;

  const zipOverrideEnabled = CHECKOUT_ENABLED_ZIP_OVERRIDES.has(normalizedZip);
  const meetsSupplyThreshold = activeProviderCount >= MIN_ACTIVE_PROVIDERS_TO_ENABLE_CHECKOUT;

  if (zipOverrideEnabled) {
    return {
      zip: normalizedZip,
      serviceable: true,
      activeProviderCount,
      bookingEnabled: true,
      reason: "active",
    };
  }

  if (!CUSTOMER_CHECKOUT_ENABLED) {
    return {
      zip: normalizedZip,
      serviceable: true,
      activeProviderCount,
      bookingEnabled: false,
      reason: "disabled_by_config",
    };
  }

  if (!meetsSupplyThreshold) {
    return {
      zip: normalizedZip,
      serviceable: true,
      activeProviderCount,
      bookingEnabled: false,
      reason: "provider_supply_building",
    };
  }

  return {
    zip: normalizedZip,
    serviceable: true,
    activeProviderCount,
    bookingEnabled: true,
    reason: "active",
  };
}
