export const PUBLIC_PROVIDER_BOOKING_INTENT_KEY = "cleanr:publicProviderBookingIntent:v1";
const INTENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type PublicProviderBookingIntent = {
  providerId: string;
  providerName: string;
  zip: string | null;
  createdAt: number;
};

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function persistPublicProviderBookingIntent(input: {
  providerId: string;
  providerName: string;
  zip?: string | null;
}): PublicProviderBookingIntent {
  const intent: PublicProviderBookingIntent = {
    providerId: input.providerId.trim(),
    providerName: input.providerName.trim() || "Selected CSP",
    zip: input.zip?.trim() || null,
    createdAt: Date.now(),
  };
  if (!intent.providerId) throw new Error("provider_id_required");
  storage()?.setItem(PUBLIC_PROVIDER_BOOKING_INTENT_KEY, JSON.stringify(intent));
  return intent;
}

export function getPublicProviderBookingIntent(): PublicProviderBookingIntent | null {
  const target = storage();
  if (!target) return null;
  try {
    const raw = target.getItem(PUBLIC_PROVIDER_BOOKING_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PublicProviderBookingIntent>;
    if (
      typeof parsed.providerId !== "string" || !parsed.providerId.trim() ||
      typeof parsed.providerName !== "string" ||
      typeof parsed.createdAt !== "number"
    ) {
      target.removeItem(PUBLIC_PROVIDER_BOOKING_INTENT_KEY);
      return null;
    }
    if (Date.now() - parsed.createdAt > INTENT_TTL_MS) {
      target.removeItem(PUBLIC_PROVIDER_BOOKING_INTENT_KEY);
      return null;
    }
    return {
      providerId: parsed.providerId.trim(),
      providerName: parsed.providerName.trim() || "Selected CSP",
      zip: typeof parsed.zip === "string" && parsed.zip.trim() ? parsed.zip.trim() : null,
      createdAt: parsed.createdAt,
    };
  } catch {
    target.removeItem(PUBLIC_PROVIDER_BOOKING_INTENT_KEY);
    return null;
  }
}

export function hasPublicProviderBookingIntent(): boolean {
  return Boolean(getPublicProviderBookingIntent());
}

export function clearPublicProviderBookingIntent(): void {
  storage()?.removeItem(PUBLIC_PROVIDER_BOOKING_INTENT_KEY);
}
