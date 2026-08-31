/**
 * Durable customer↔CSP relationship truth.
 *
 * Bookings remain the transaction record. A service relationship captures continuity that
 * survives any single booking without implying ownership or exclusivity.
 */

export type ServiceRelationshipKind = "established" | "recurring";
export type ServiceRelationshipStatus = "active" | "paused" | "ended";
export type ServiceRelationshipOrigin =
  | "booking_history"
  | "customer_selection"
  | "provider_brought"
  | "admin"
  | "system";

export interface ServiceRelationship {
  id: string;
  customerId: string;
  providerId: string;
  kind: ServiceRelationshipKind;
  status: ServiceRelationshipStatus;
  origin: ServiceRelationshipOrigin;
  customerPreferred: boolean;
  preferredAt?: string | null;
  firstBookingId?: string | null;
  latestBookingId?: string | null;
  completedServicesCount: number;
  firstServedAt?: string | null;
  lastServedAt?: string | null;
  nextScheduledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderHouseholdRelationshipSummary {
  customerId: string;
  householdLabel: string;
  relationship?: ServiceRelationship | null;
  completedServicesCount: number;
  firstServedAt: string | null;
  lastServedAt: string | null;
  nextScheduledAt: string | null;
  source: "durable_relationship" | "booking_history";
}
