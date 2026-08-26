export const CLEANING_EXPERIENCE_BUCKETS = ["lt_1y", "1_3y", "3_5y", "5y_plus"] as const;
export type CleaningExperienceBucket = (typeof CLEANING_EXPERIENCE_BUCKETS)[number];

export const PROVIDER_REVIEW_BANDS = ["priority_review", "standard_review", "future_consideration"] as const;
export type ProviderReviewBand = (typeof PROVIDER_REVIEW_BANDS)[number];

/**
 * Deterministic triage: 1 point each for strong experience (3+ years bucket), own equipment, reliable transportation.
 * Not a rejection gate — prioritization for review only.
 */
export function computeProviderReviewBand(params: {
  cleaning_experience_bucket: CleaningExperienceBucket;
  has_own_equipment: boolean;
  has_reliable_transportation: boolean;
}): ProviderReviewBand {
  let score = 0;
  if (params.cleaning_experience_bucket === "3_5y" || params.cleaning_experience_bucket === "5y_plus") {
    score += 1;
  }
  if (params.has_own_equipment) score += 1;
  if (params.has_reliable_transportation) score += 1;
  if (score === 3) return "priority_review";
  if (score >= 1) return "standard_review";
  return "future_consideration";
}
