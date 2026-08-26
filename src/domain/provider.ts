/**
 * Shared provider domain. No UI.
 * Used by both customer (choose provider) and provider (availability, earnings).
 */

export interface Provider {
  id: string;
  displayName: string;
  rating?: number;
  reviewCount?: number;
  serviceAreas?: string[];
  // extend as needed
}
