export interface PublicProvider {
  id: string;
  full_name: string | null;
  service_radius_miles: number | null;
  marketplace_access: boolean | null;
  created_at: string | null;
  avg_rating: number | null;
  review_count: number | null;
  background_checked: boolean | null;
  insured: boolean | null;
  platform_verified: boolean | null;
}

export function providerDisplayName(provider: { full_name: string | null }): string {
  return provider.full_name?.trim() || "Cleaning Service Professional";
}
