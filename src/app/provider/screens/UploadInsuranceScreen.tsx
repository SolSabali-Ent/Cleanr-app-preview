import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useProfile } from "../../../lib/useProfile";
import {
  CSP_PRIMARY_BUTTON,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";
import { traceProfileWriteStart, traceProfileWriteResult } from "@/lib/debug/profileWriteTrace";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Format YYYY-MM-DD for display (e.g. "March 15, 2025"). Same as booking date field. */
function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T12:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function UploadInsuranceScreen() {
  const navigate = useNavigate();
  const { profile, refresh } = useProfile();
  const [file, setFile] = useState<File | null>(null);
  const [coverage, setCoverage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    if (!profile || !file) {
      setError("Please choose a file.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);

    const safeName = sanitizeFilename(file.name);
    const path = `providers/${profile.id}/insurance/${Date.now()}-${safeName}`;

    const upload = await supabase.storage
      .from("provider-documents")
      .upload(path, file, { upsert: true });
    if (upload.error) {
      setError(upload.error.message);
      setSaving(false);
      return;
    }

    const coverageCents = coverage.trim() ? Math.round(Number(coverage) * 100) : null;
    const rpcPayload = {
      p_document_path: path,
      p_coverage_cents: Number.isFinite(coverageCents) ? coverageCents : null,
      p_expires_on: expiresAt || null,
    };
    const traceRpc = await traceProfileWriteStart({
      source: "UploadInsuranceScreen.handleSubmit:submit_insurance_document",
      operation: "rpc",
      targetId: profile.id,
      payload: rpcPayload,
      cspFlowState: { insurance_status: profile.insurance_status },
    });
    const submitResult = await supabase.rpc("submit_insurance_document", rpcPayload);
    traceProfileWriteResult(traceRpc, submitResult);

    if (submitResult.error) {
      setError(
        submitResult.error.message.includes("insurance_already_verified")
          ? "Your verified insurance evidence can’t be replaced from this screen. Contact support when you need to renew or update it."
          : submitResult.error.message
      );
      setSaving(false);
      return;
    }

    await refresh();
    setSaving(false);
    setMessage("Submitted — pending review");
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Insurance (optional)</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Upload insurance if you have it. It is not required to join or accept jobs.
        </p>
      </header>

      <div className="space-y-3">
        <div className="w-full min-w-0">
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full min-w-0 max-w-full text-base box-border"
          />
        </div>
        <div className="w-full min-w-0">
          <input
            type="number"
            min={0}
            step="0.01"
            value={coverage}
            onChange={(e) => setCoverage(e.target.value)}
            placeholder="Coverage amount in dollars (optional)"
            className="h-11 w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-white/5 px-3 text-base text-white placeholder-slate-300 box-border"
          />
        </div>
        {/* Same shell + overlay pattern as booking date field: visible shell controls layout; native input absolutely over with opacity 0 so iOS opens picker. */}
        <div className="w-full min-w-0">
          <div className="relative w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/5 pl-3 pr-10 py-2 min-h-[44px] flex items-center focus-within:outline-none focus-within:ring-2 focus-within:ring-white/30">
            <span
              className={`pointer-events-none flex-1 min-w-0 text-base ${expiresAt ? "text-white" : "text-slate-400"}`}
              aria-hidden
            >
              {expiresAt ? formatDateDisplay(expiresAt) : "Expiration date (optional)"}
            </span>
            <Calendar
              className="w-4 h-4 text-slate-400 shrink-0 ml-auto pointer-events-none"
              aria-hidden
            />
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="absolute inset-0 w-full h-full cursor-pointer z-10 opacity-[0.01]"
              style={{ fontSize: "16px" }}
              aria-label="Expiration date (optional)"
            />
          </div>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-emerald-300">{message}</p> : null}

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={handleUpload}
          disabled={saving}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
        >
          {saving ? "Uploading..." : "Get Verified"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/csp/dashboard/application/identity")}
          className="w-full py-3 rounded-xl text-sm font-medium border"
          style={{ borderColor: "rgba(248, 250, 252, 0.12)", color: CSP_TEXT_SECONDARY }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
