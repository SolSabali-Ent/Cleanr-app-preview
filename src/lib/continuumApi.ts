import type { ContinuumParticipation, ContinuumParticipationKey } from "@/domain/continuum";
import { isOfflinePreviewMode, supabase } from "@/lib/supabase";

type Row = {
  id: string;
  person_id: string;
  participation_key: ContinuumParticipationKey;
  status: ContinuumParticipation["status"];
  origin: ContinuumParticipation["origin"];
  evidence_status: ContinuumParticipation["evidenceStatus"];
  evidence_source_system: ContinuumParticipation["evidenceSourceSystem"];
  provenance_type: string | null;
  provenance_id: string | null;
  evidence_note: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

const FIELDS = "id, person_id, participation_key, status, origin, evidence_status, evidence_source_system, provenance_type, provenance_id, evidence_note, started_at, ended_at, created_at, updated_at";

function mapRow(row: Row): ContinuumParticipation {
  return {
    id: row.id,
    personId: row.person_id,
    key: row.participation_key,
    status: row.status,
    origin: row.origin,
    evidenceStatus: row.evidence_status,
    evidenceSourceSystem: row.evidence_source_system,
    provenanceType: row.provenance_type,
    provenanceId: row.provenance_id,
    evidenceNote: row.evidence_note,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function relationMissing(error: { code?: string; message?: string } | null): boolean {
  const message = (error?.message ?? "").toLowerCase();
  return error?.code === "42P01" || error?.code === "PGRST205" || (message.includes("continuum_participations") && message.includes("does not exist"));
}

export async function listMyContinuumParticipations(): Promise<ContinuumParticipation[]> {
  if (isOfflinePreviewMode) return [];
  const { data, error } = await supabase
    .from("continuum_participations")
    .select(FIELDS)
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  if (relationMissing(error)) return [];
  if (error) throw error;
  return ((data ?? []) as Row[]).map(mapRow);
}

export async function setMyContinuumParticipation(key: ContinuumParticipationKey, active: boolean): Promise<ContinuumParticipation> {
  if (isOfflinePreviewMode) throw new Error("Continuum participation is unavailable in offline preview mode.");
  const { data, error } = await supabase.rpc("set_my_continuum_participation", {
    p_participation_key: key,
    p_active: active,
  });
  if (error) throw error;
  return mapRow(data as Row);
}
