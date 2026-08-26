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

export interface NetworkRelationship {
  id: string;
  sourcePersonId: string;
  targetPersonId: string;
  type: NetworkRelationshipType;
  status: NetworkRelationshipStatus;
  origin: NetworkRelationshipOrigin;
  purpose?: string | null;
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
