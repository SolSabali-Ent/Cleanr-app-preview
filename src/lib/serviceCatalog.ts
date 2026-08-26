/**
 * Residential booking service taxonomy: single domain, three options, stable display names.
 * Used for DB labels (create_booking_geo), Kinex payloads, and customer-facing copy.
 */

export const SERVICE_DOMAIN = "residential" as const;

export type ServiceOptionKey = "standard" | "deep" | "moveout";

export const SERVICE_DISPLAY_NAME: Record<ServiceOptionKey, string> = {
  standard: "Standard Clean",
  deep: "Deep Clean",
  moveout: "Move-out Clean",
};

/** Wizard cards: option keys match `BookingState.serviceType`. */
export const WIZARD_SERVICE_CARDS: readonly {
  optionKey: ServiceOptionKey;
  subtitle: string;
  badge?: string;
  priceLabel: string;
  icon: string;
}[] = [
  {
    optionKey: "standard",
    subtitle: "For tidy homes that need a regular reset.",
    badge: "Most popular",
    priceLabel: "From $99",
    icon: "🏠",
  },
  {
    optionKey: "deep",
    subtitle: "Inside appliances, baseboards, and detail work.",
    badge: "Best for first visit",
    priceLabel: "From $149",
    icon: "✨",
  },
  {
    optionKey: "moveout",
    subtitle: "Turnkey clean between tenants or when moving.",
    priceLabel: "Custom quote",
    icon: "🚚",
  },
];

/** Map wizard selection, legacy DB text, or Kinex-era values to a canonical option key. */
export function serviceOptionKeyFromStored(raw: string | null | undefined): ServiceOptionKey {
  const t = (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!t || t === "residential") return "standard";
  if (t === "deep" || t === "deep clean" || t.startsWith("deep")) return "deep";
  if (t === "moveout" || t === "move-out" || t === "move-out clean" || t.includes("move")) return "moveout";
  if (t === "standard" || t === "standard clean" || t.startsWith("standard")) return "standard";
  return "standard";
}

/** Label persisted on `bookings.service_type` (matches create_booking_geo default style). */
export function persistedServiceLabelForCreateBooking(wizardServiceType: string | null): string {
  const key = serviceOptionKeyFromStored(wizardServiceType);
  return SERVICE_DISPLAY_NAME[key];
}

/** Customer-facing line from whatever is stored on the booking row. */
export function customerFacingServiceLabel(storedServiceType: string | null | undefined): string {
  const key = serviceOptionKeyFromStored(storedServiceType);
  return SERVICE_DISPLAY_NAME[key];
}

/** Kinex payload slice: `service_type` is the domain string for spine consistency. */
export function kinexServiceFieldsFromStored(storedBookingServiceType: string | null | undefined): {
  service_domain: typeof SERVICE_DOMAIN;
  service_option_key: ServiceOptionKey;
  service_display_name: string;
  service_type: typeof SERVICE_DOMAIN;
} {
  const key = serviceOptionKeyFromStored(storedBookingServiceType);
  return {
    service_domain: SERVICE_DOMAIN,
    service_option_key: key,
    service_display_name: SERVICE_DISPLAY_NAME[key],
    service_type: SERVICE_DOMAIN,
  };
}
