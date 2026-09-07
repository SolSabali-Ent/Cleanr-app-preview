export interface PublicProvider {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  profile_photo_path: string | null;
  provider_bio: string | null;
  years_experience: number | null;
  languages: string[];
  specialties: string[];
  service_area_labels: string[];
  repeat_household_count: number | null;
  service_radius_miles: number | null;
  marketplace_access: boolean | null;
  created_at: string | null;
  avg_rating: number | null;
  review_count: number | null;
  background_checked: boolean | null;
  insured: boolean | null;
  platform_verified: boolean | null;
}

export function providerDisplayName(provider: { full_name: string | null; preferred_name?: string | null }): string {
  return provider.preferred_name?.trim() || provider.full_name?.trim() || "Cleaning Service Professional";
}
