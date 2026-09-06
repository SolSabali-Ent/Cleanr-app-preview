import { supabase } from "./supabase";

export type VisitEvidenceKind = "before" | "after";

export type VisitEvidenceRecord = {
  id: string;
  bookingId: string;
  providerId: string;
  kind: VisitEvidenceKind;
  storagePath: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadStatus: "pending" | "stored";
  customerVisible: boolean;
  createdAt: string;
  storedAt: string | null;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_KIND = 8;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

function asRecord(row: Record<string, unknown>): VisitEvidenceRecord {
  return {
    id: String(row.id ?? ""),
    bookingId: String(row.booking_id ?? ""),
    providerId: String(row.provider_id ?? ""),
    kind: String(row.evidence_kind ?? "before") as VisitEvidenceKind,
    storagePath: String(row.storage_path ?? ""),
    originalFileName: String(row.original_file_name ?? ""),
    mimeType: String(row.mime_type ?? ""),
    fileSizeBytes: Number(row.file_size_bytes ?? 0),
    uploadStatus: String(row.upload_status ?? "pending") as VisitEvidenceRecord["uploadStatus"],
    customerVisible: row.customer_visible === true,
    createdAt: String(row.created_at ?? ""),
    storedAt: typeof row.stored_at === "string" ? row.stored_at : null,
  };
}

function validateFile(file: File) {
  if (!ALLOWED_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Only JPEG, PNG, WebP, HEIC, or HEIF images are supported.");
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Each photo must be 10 MB or smaller.");
  }
}

export async function listMyVisitEvidence(
  bookingId: string,
  kind?: VisitEvidenceKind
): Promise<VisitEvidenceRecord[]> {
  let query = supabase
    .from("booking_visit_evidence")
    .select("id,booking_id,provider_id,evidence_kind,storage_path,original_file_name,mime_type,file_size_bytes,upload_status,customer_visible,created_at,stored_at")
    .eq("booking_id", bookingId)
    .eq("upload_status", "stored")
    .order("created_at", { ascending: true });

  if (kind) query = query.eq("evidence_kind", kind);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(asRecord);
}

export async function uploadProviderVisitEvidence(
  bookingId: string,
  kind: VisitEvidenceKind,
  files: File[]
): Promise<VisitEvidenceRecord[]> {
  if (files.length === 0) return listMyVisitEvidence(bookingId, kind);
  if (files.length > MAX_FILES_PER_KIND) throw new Error(`Upload up to ${MAX_FILES_PER_KIND} photos at a time.`);
  files.forEach(validateFile);

  const existing = await listMyVisitEvidence(bookingId, kind);
  if (existing.length + files.length > MAX_FILES_PER_KIND) {
    throw new Error(`This visit can keep up to ${MAX_FILES_PER_KIND} ${kind}-service photos.`);
  }

  for (const file of files) {
    const { data: prepared, error: prepareError } = await supabase.rpc("prepare_provider_visit_evidence", {
      p_booking_id: bookingId,
      p_kind: kind,
      p_file_name: file.name,
      p_mime_type: file.type.toLowerCase(),
      p_size_bytes: file.size,
    });
    if (prepareError) throw prepareError;

    const payload = prepared && typeof prepared === "object" ? prepared as Record<string, unknown> : {};
    const evidenceId = typeof payload.evidence_id === "string" ? payload.evidence_id : null;
    const storagePath = typeof payload.storage_path === "string" ? payload.storage_path : null;
    if (!evidenceId || !storagePath) throw new Error("Cleanr could not reserve evidence storage.");

    const { error: uploadError } = await supabase.storage
      .from("visit-evidence")
      .upload(storagePath, file, { upsert: false, contentType: file.type });
    if (uploadError) throw uploadError;

    const { error: completeError } = await supabase.rpc("complete_provider_visit_evidence", {
      p_evidence_id: evidenceId,
    });
    if (completeError) throw completeError;
  }

  return listMyVisitEvidence(bookingId, kind);
}

export const visitEvidenceLimits = {
  maxFilesPerKind: MAX_FILES_PER_KIND,
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
};
