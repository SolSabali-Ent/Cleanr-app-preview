import { supabase } from "./supabase";

export type PublicProviderPresenceCard = {
  id: string;
  full_name: string | null;
  profile_photo_path: string | null;
  avg_rating: number | null;
  review_count: number;
  background_checked: boolean;
  insured: boolean;
  platform_verified: boolean;
};

export type MarketplaceProviderChoice = PublicProviderPresenceCard & {
  preferred_name: string | null;
  provider_bio: string | null;
  years_experience: number | null;
  specialties: string[];
  service_area_labels: string[];
  repeat_household_count: number;
};

export type ProviderPresenceSummary = {
  market: "metro_atl";
  searched_zip: string | null;
  zip_supported: boolean | null;
  active_provider_count: number | null;
  has_provider_coverage: boolean;
  sample_providers: PublicProviderPresenceCard[];
};

type ProviderPresenceOptions = {
  zip?: string | null;
  sampleLimit?: number;
};

function rowToMarketplaceProvider(row: Record<string, unknown>): MarketplaceProviderChoice {
  return {
    id: String(row.id ?? ""),
    full_name: (row.full_name as string | null) ?? null,
    preferred_name: (row.preferred_name as string | null) ?? null,
    profile_photo_path: (row.profile_photo_path as string | null) ?? null,
    provider_bio: (row.provider_bio as string | null) ?? null,
    years_experience: row.years_experience == null ? null : Number(row.years_experience),
    specialties: Array.isArray(row.specialties) ? row.specialties.map(String) : [],
    service_area_labels: Array.isArray(row.service_area_labels) ? row.service_area_labels.map(String) : [],
    avg_rating: row.avg_rating == null ? null : Number(row.avg_rating),
    review_count: Number(row.review_count ?? 0),
    repeat_household_count: Number(row.repeat_household_count ?? 0),
    background_checked: Boolean(row.background_checked),
    // Do not surface a generic "Insured" claim from public marketplace data.
    // Cleanr may retain verified provider-supplied insurance evidence internally,
    // but public coverage language stays off until the actual policy/representation
    // boundary is finalized. Specific in-app surfaces can use precise wording.
    insured: false,
    platform_verified: Boolean(row.platform_verified),
  };
}

/** Public marketplace listing for CSPs who are both eligible and accepting new work. */
export async function listMarketplaceProvidersPublic(limit = 12): Promise<MarketplaceProviderChoice[]> {
  const { data, error } = await supabase
    .from("provider_public_profiles")
    .select("id,full_name,preferred_name,profile_photo_path,provider_bio,years_experience,specialties,service_area_labels,avg_rating,review_count,repeat_household_count,background_checked,insured,platform_verified")
    .eq("marketplace_access", true)
    .eq("accepts_new_marketplace_work", true)
    .order("review_count", { ascending: false })
    .order("avg_rating", { ascending: false })
    .order("full_name", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 50)));

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(rowToMarketplaceProvider);
}

/**
 * Returns public-safe CSP cards whose configured service radius plausibly reaches
 * the ZIP centroid. Exact street-address and schedule eligibility are validated
 * later against the durable booking before payment.
 */
export async function listMarketplaceProvidersForZip(
  zip: string,
  limit = 6,
): Promise<MarketplaceProviderChoice[]> {
  const normalizedZip = zip.trim();
  if (!/^\d{5}$/.test(normalizedZip)) return [];

  const { data, error } = await supabase.rpc("list_marketplace_providers_for_zip", {
    p_zip: normalizedZip,
    p_limit: Math.max(1, Math.min(limit, 50)),
  });
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map(rowToMarketplaceProvider);
}

/**
 * Public-safe provider presence summary for customer-facing NEW-marketplace
 * coverage messaging. Existing relationship continuity is intentionally separate.
 */
export async function getProviderPresenceSummary(
  options: ProviderPresenceOptions = {}
): Promise<ProviderPresenceSummary> {
  const zip = options.zip?.trim() || null;
  const sampleLimit = Math.max(0, Math.min(options.sampleLimit ?? 3, 6));

  let zipSupported: boolean | null = null;
  if (zip) {
    const { data, error } = await supabase.rpc("validate_service_zip", { p_zip: zip });
    if (!error && typeof data === "boolean") {
      zipSupported = data;
    }
  }

  const { count, error: countError } = await supabase
    .from("provider_public_profiles")
    .select("id", { count: "exact", head: true })
    .eq("marketplace_access", true)
    .eq("accepts_new_marketplace_work", true);

  const activeProviderCount = countError ? null : (count ?? 0);

  let sampleProviders: PublicProviderPresenceCard[] = [];
  if (sampleLimit > 0) {
    if (zip) {
      try {
        const zipProviders = await listMarketplaceProvidersForZip(zip, sampleLimit);
        sampleProviders = zipProviders.map(({ id, full_name, profile_photo_path, avg_rating, review_count, background_checked, insured, platform_verified }) => ({
          id,
          full_name,
          profile_photo_path,
          avg_rating,
          review_count,
          background_checked,
          insured,
          platform_verified,
        }));
      } catch {
        sampleProviders = [];
      }
    } else {
      const { data: sampleRows, error: sampleError } = await supabase
        .from("provider_public_profiles")
        .select(
          "id, full_name, profile_photo_path, avg_rating, review_count, background_checked, insured, platform_verified"
        )
        .eq("marketplace_access", true)
        .eq("accepts_new_marketplace_work", true)
        .order("review_count", { ascending: false })
        .order("full_name", { ascending: true })
        .limit(sampleLimit);

      if (!sampleError && Array.isArray(sampleRows)) {
        sampleProviders = sampleRows.map((row) => ({
          id: String(row.id),
          full_name: row.full_name ?? null,
          profile_photo_path: row.profile_photo_path ?? null,
          avg_rating: typeof row.avg_rating === "number" ? row.avg_rating : null,
          review_count: Number(row.review_count ?? 0),
          background_checked: Boolean(row.background_checked),
          insured: false,
          platform_verified: Boolean(row.platform_verified),
        }));
      }
    }
  }

  const hasProviderCoverage = zip
    ? (zipSupported !== false && sampleProviders.length > 0)
    : (activeProviderCount !== null && activeProviderCount > 0);

  return {
    market: "metro_atl",
    searched_zip: zip,
    zip_supported: zipSupported,
    active_provider_count: activeProviderCount,
    has_provider_coverage: hasProviderCoverage,
    sample_providers: sampleProviders,
  };
}
