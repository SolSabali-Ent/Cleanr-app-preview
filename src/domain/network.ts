/**
 * Durable person-to-person relationship truth for the Cleanr Network.
 *
 * This is not a social graph or feed. It records bounded relationships that help people
 * create value together: mentorship, peer support, coverage, and collaboration.
 */

export type NetworkRelationshipType =
  | "mentor"
  | "peer"
  | "coverage_partner"
  | "business_collaborator";

export type NetworkRelationshipStatus =
  | "suggested"
  | "requested"
  | "active"
  | "declined"
  | "ended";

export type NetworkRelationshipOrigin = "person" | "kinex" | "admin" | "system";

export type NetworkRelationshipProvenanceType =
  | "opportunity_match"
  | "booking"
  | "referral"
  | "admin"
  | "system";

export type NetworkParticipantRole = "mentor" | "mentee";

export interface NetworkRelationship {
  id: string;
  sourcePersonId: string;
  targetPersonId: string;
  type: NetworkRelationshipType;
  status: NetworkRelationshipStatus;
  origin: NetworkRelationshipOrigin;
  purpose?: string | null;
  provenanceType: NetworkRelationshipProvenanceType;
  provenanceId?: string | null;
  sourceRole?: NetworkParticipantRole | null;
  targetRole?: NetworkParticipantRole | null;
  introducedAt: string;
  sourceAcceptedAt?: string | null;
  targetAcceptedAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NetworkConnectionSummary {
  relationship: NetworkRelationship;
  direction: "outbound" | "inbound";
}

/**
 * Relationship activation must be consensual. A suggested/requested relationship is not
 * treated as active until both participants have accepted it.
 */
export function relationshipIsActive(relationship: NetworkRelationship): boolean {
  return relationship.status === "active" && Boolean(
    relationship.sourceAcceptedAt && relationship.targetAcceptedAt
  );
}

export function myNetworkRole(
  summary: NetworkConnectionSummary
): NetworkParticipantRole | null {
  const { relationship, direction } = summary;
  return direction === "outbound"
    ? relationship.sourceRole ?? null
    : relationship.targetRole ?? null;
}
