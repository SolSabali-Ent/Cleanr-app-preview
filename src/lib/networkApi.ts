import { isOfflinePreviewMode, supabase } from "@/lib/supabase";
import type {
  NetworkConnectionSummary,
  NetworkRelationship,
  NetworkRelationshipProvenanceType,
  NetworkRelationshipStatus,
  NetworkRelationshipType,
  NetworkParticipantRole,
} from "@/domain/network";

type NetworkRelationshipRow = {
  id: string;
  source_person_id: string;
  target_person_id: string;
  relationship_type: NetworkRelationshipType;
  status: NetworkRelationshipStatus;
  origin: NetworkRelationship["origin"];
  purpose: string | null;
  provenance_type: NetworkRelationshipProvenanceType;
  provenance_id: string | null;
  source_role: NetworkParticipantRole | null;
  target_role: NetworkParticipantRole | null;
  introduced_at: string;
  source_accepted_at: string | null;
  target_accepted_at: string | null;
  started_at: string | null;
  declined_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapRelationship(row: NetworkRelationshipRow): NetworkRelationship {
  return {
    id: row.id,
    sourcePersonId: row.source_person_id,
    targetPersonId: row.target_person_id,
    type: row.relationship_type,
    status: row.status,
    origin: row.origin,
    purpose: row.purpose,
    provenanceType: row.provenance_type,
    provenanceId: row.provenance_id,
    sourceRole: row.source_role,
    targetRole: row.target_role,
    introducedAt: row.introduced_at,
    sourceAcceptedAt: row.source_accepted_at,
    targetAcceptedAt: row.target_accepted_at,
    startedAt: row.started_at,
    declinedAt: row.declined_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const NETWORK_SELECT = "id, source_person_id, target_person_id, relationship_type, status, origin, purpose, provenance_type, provenance_id, source_role, target_role, introduced_at, source_accepted_at, target_accepted_at, started_at, declined_at, ended_at, created_at, updated_at";

export async function listMyNetworkRelationships(): Promise<NetworkConnectionSummary[]> {
  if (isOfflinePreviewMode) return [];

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const personId = authData.user?.id;
  if (!personId) return [];

  const { data, error } = await supabase
    .from("network_relationships")
    .select(NETWORK_SELECT)
    .or(`source_person_id.eq.${personId},target_person_id.eq.${personId}`)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as NetworkRelationshipRow[]).map((row) => ({
    relationship: mapRelationship(row),
    direction: row.source_person_id === personId ? "outbound" : "inbound",
  }));
}

export async function respondToNetworkRelationship(
  relationshipId: string,
  response: "accept" | "decline" | "end"
): Promise<NetworkRelationship> {
  if (isOfflinePreviewMode) {
    throw new Error("Network relationship responses are unavailable in offline preview mode.");
  }

  const { data, error } = await supabase.rpc("respond_to_network_relationship", {
    p_relationship_id: relationshipId,
    p_response: response,
  });

  if (error) throw error;
  return mapRelationship(data as NetworkRelationshipRow);
}
