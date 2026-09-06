import { useEffect, useMemo, useState } from "react";
import { Camera, Check, ShieldCheck } from "lucide-react";
import {
  listMyVisitEvidence,
  uploadProviderVisitEvidence,
  visitEvidenceLimits,
  type VisitEvidenceKind,
  type VisitEvidenceRecord,
} from "../../../lib/visitEvidenceApi";

type Props = {
  bookingId: string;
  kind: VisitEvidenceKind;
  disabled?: boolean;
  compact?: boolean;
};

function labelForKind(kind: VisitEvidenceKind) {
  return kind === "before" ? "Before-service photos" : "After-service photos";
}

function helpForKind(kind: VisitEvidenceKind) {
  return kind === "before"
    ? "Document the starting condition only when it helps protect you and the household."
    : "Document the finished condition when it is useful for service continuity or protection.";
}

export default function VisitEvidencePanel({ bookingId, kind, disabled = false, compact = false }: Props) {
  const [records, setRecords] = useState<VisitEvidenceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    listMyVisitEvidence(bookingId, kind)
      .then((rows) => {
        if (mounted) setRecords(rows);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Could not load stored visit photos.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [bookingId, kind]);

  const remaining = Math.max(0, visitEvidenceLimits.maxFilesPerKind - records.length);
  const storedNames = useMemo(() => records.map((row) => row.originalFileName), [records]);

  const uploadFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []);
    if (files.length === 0 || disabled || uploading) return;
    setError(null);
    setNotice(null);
    setUploading(true);
    try {
      const next = await uploadProviderVisitEvidence(bookingId, kind, files);
      setRecords(next);
      setNotice(`${files.length} photo${files.length === 1 ? "" : "s"} stored privately for this visit.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not store visit photos.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className={`rounded-2xl border shadow-md ${compact ? "p-3" : "p-4"} ${kind === "before" ? "border-slate-700/80 bg-slate-900/75" : "border-slate-200 bg-white"}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${kind === "before" ? "bg-[#0A84FF]/15 text-[#7DBBFF]" : "bg-emerald-50 text-emerald-700"}`}>
          <Camera size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-semibold ${kind === "before" ? "text-white" : "text-slate-900"}`}>{labelForKind(kind)}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${kind === "before" ? "border-slate-600 text-slate-400" : "border-slate-300 text-slate-500"}`}>Optional</span>
          </div>
          <p className={`mt-1 text-[11px] leading-4 ${kind === "before" ? "text-slate-400" : "text-slate-500"}`}>{helpForKind(kind)}</p>
        </div>
      </div>

      <div className={`mt-3 rounded-xl border px-3 py-2.5 ${kind === "before" ? "border-slate-700 bg-slate-950/40" : "border-slate-200 bg-slate-50"}`}>
        <div className="flex items-start gap-2">
          <ShieldCheck size={15} className={`mt-0.5 shrink-0 ${kind === "before" ? "text-slate-400" : "text-slate-500"}`} />
          <p className={`text-[10px] leading-4 ${kind === "before" ? "text-slate-400" : "text-slate-500"}`}>
            These are private service-condition records. They are not automatically shared with the customer and do not become household memory. Use them only when they support trust, continuity, or protection.
          </p>
        </div>
      </div>

      {loading ? (
        <p className={`mt-3 text-[11px] ${kind === "before" ? "text-slate-500" : "text-slate-500"}`}>Loading stored evidence…</p>
      ) : records.length > 0 ? (
        <div className={`mt-3 rounded-xl border px-3 py-2.5 ${kind === "before" ? "border-emerald-500/20 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50"}`}>
          <div className={`flex items-center gap-2 ${kind === "before" ? "text-emerald-200" : "text-emerald-800"}`}>
            <Check size={14} />
            <p className="text-[11px] font-semibold">{records.length} photo{records.length === 1 ? "" : "s"} stored</p>
          </div>
          <p className={`mt-1 truncate text-[10px] ${kind === "before" ? "text-emerald-200/70" : "text-emerald-700"}`}>{storedNames.join(", ")}</p>
        </div>
      ) : (
        <p className={`mt-3 text-[10px] leading-4 ${kind === "before" ? "text-slate-500" : "text-slate-500"}`}>No photos stored. Skip this when documentation is unnecessary.</p>
      )}

      {error ? <p className="mt-3 text-[11px] font-medium text-red-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-[11px] font-medium text-emerald-500">{notice}</p> : null}

      {!disabled && remaining > 0 ? (
        <label className={`mt-3 flex min-h-[58px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-3 py-2.5 transition ${kind === "before" ? "border-slate-600 bg-slate-950/50 hover:border-[#0A84FF]/70" : "border-slate-300 bg-slate-50 hover:border-[#0A84FF]/70"}`}>
          <div>
            <p className={`text-xs font-semibold ${kind === "before" ? "text-white" : "text-slate-900"}`}>{uploading ? "Storing photos…" : "Add photos"}</p>
            <p className={`mt-0.5 text-[10px] ${kind === "before" ? "text-slate-500" : "text-slate-500"}`}>Up to {remaining} more · 10 MB each</p>
          </div>
          <Camera size={17} className={kind === "before" ? "text-slate-400" : "text-slate-500"} />
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              void uploadFiles(event.target.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      ) : disabled ? (
        <p className={`mt-3 text-[10px] leading-4 ${kind === "before" ? "text-slate-500" : "text-slate-500"}`}>Photo uploads close when the service is marked finished.</p>
      ) : (
        <p className={`mt-3 text-[10px] leading-4 ${kind === "before" ? "text-slate-500" : "text-slate-500"}`}>Maximum of {visitEvidenceLimits.maxFilesPerKind} photos stored for this stage.</p>
      )}
    </section>
  );
}
