import { supabase } from "./supabase";

export type PublicProviderPresenceCard = {
  id: string;
  full_name: string | null;
  avg_rating: number | null;
  review_count: number;
  background_checked: boolean;
  insured: boolean;
  platform_verified: boolean;
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

/**
 * Public-safe provider presence summary for customer-facing coverage messaging.
 * Uses provider_public_profiles only; does not expose private profile fields.
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
    .eq("marketplace_access", true);

  const activeProviderCount = countError ? null : (count ?? 0);

  let sampleProviders: PublicProviderPresenceCard[] = [];
  if (sampleLimit > 0) {
    const { data: sampleRows, error: sampleError } = await supabase
      .from("provider_public_profiles")
      .select(
        "id, full_name, avg_rating, review_count, background_checked, insured, platform_verified"
      )
      .eq("marketplace_access", true)
      .order("review_count", { ascending: false })
      .order("full_name", { ascending: true })
      .limit(sampleLimit);

    if (!sampleError && Array.isArray(sampleRows)) {
      sampleProviders = sampleRows.map((row) => ({
        id: String(row.id),
        full_name: row.full_name ?? null,
        avg_rating: typeof row.avg_rating === "number" ? row.avg_rating : null,
        review_count: Number(row.review_count ?? 0),
        background_checked: Boolean(row.background_checked),
        insured: Boolean(row.insured),
        platform_verified: Boolean(row.platform_verified),
      }));
    }
  }

  const hasProviderCoverage =
    (zipSupported !== false) && activeProviderCount !== null && activeProviderCount > 0;

  return {
    market: "metro_atl",
    searched_zip: zip,
    zip_supported: zipSupported,
    active_provider_count: activeProviderCount,
    has_provider_coverage: hasProviderCoverage,
    sample_providers: sampleProviders,
  };
}
