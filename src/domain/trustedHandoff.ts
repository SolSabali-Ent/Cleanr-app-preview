/**
 * Trust-transfer state for a specific residential service booking.
 *
 * A handoff does not reassign a booking or replace marketplace fulfillment logic. It records
 * who introduced a trusted backup, why, and whether the backup CSP and household both agreed.
 */

export type TrustedServiceHandoffReason =
  | "availability"
  | "time_off"
  | "coverage"
  | "continuity"
  | "other";

export type TrustedServiceHandoffStatus =
  | "proposed"
  | "backup_accepted"
  | "customer_confirmed"
  | "active"
  | "declined"
  | "cancelled"
  | "completed";

export type TrustedServiceHandoffViewerRole =
  | "from_provider"
  | "backup_provider"
  | "customer";

export interface TrustedServiceHandoff {
  id: string;
  bookingId: string;
  customerId: string;
  fromProviderId: string;
  toProviderId: string;
  coverageRelationshipId: string;
  reason: TrustedServiceHandoffReason;
  reasonNote?: string | null;
  status: TrustedServiceHandoffStatus;
  sourceConfirmedAt: string;
  backupAcceptedAt?: string | null;
  customerConfirmedAt?: string | null;
  activatedAt?: string | null;
  declinedAt?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrustedServiceHandoffSummary {
  handoff: TrustedServiceHandoff;
  viewerRole: TrustedServiceHandoffViewerRole;
}

export function trustedHandoffIsActive(handoff: TrustedServiceHandoff): boolean {
  return handoff.status === "active" && Boolean(
    handoff.backupAcceptedAt && handoff.customerConfirmedAt && handoff.activatedAt
  );
}
