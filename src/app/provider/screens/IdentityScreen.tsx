import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

function stepMode(status: string | null | undefined): "not_started" | "submitted" | "completed" {
  if (!status) return "not_started";
  const n = status.toLowerCase();
  if (["verified", "approved", "completed"].includes(n)) return "completed";
  if (["submitted", "under_review", "pending"].includes(n)) return "submitted";
  return "not_started";
}

export default function IdentityScreen() {
  const navigate = useNavigate();
  const { profile, refresh } = useProfile();
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mode = stepMode(profile?.identity_status);

  async function handleUpload() {
    if (!profile || !file) {
      setError("Please choose a file.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);

    const safeName = sanitizeFilename(file.name);
    const path = `providers/${profile.id}/identity/${Date.now()}-${safeName}`;

    const upload = await supabase.storage
      .from("provider-documents")
      .upload(path, file, { upsert: true });
    if (upload.error) {
      setError(upload.error.message);
      setSaving(false);
      return;
    }

    const idPayload = { identity_document_path: path };
    const traceUpd = await traceProfileWriteStart({
      source: "IdentityScreen.handleSubmit",
      operation: "update",
      targetId: profile.id,
      payload: idPayload,
      cspFlowState: { identity_status: profile.identity_status, application_status: profile.application_status },
    });
    const updateResult = await supabase.from("profiles").update(idPayload).eq("id", profile.id);
    traceProfileWriteResult(traceUpd, updateResult);
    const { error: updateError } = updateResult;
    if (updateError) {
      setError(updateError.message);
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
        <h1 className="text-2xl font-semibold">ID verification</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Customers trust verified pros. Upload a government-issued ID to continue.
        </p>
      </header>

      {mode === "completed" && (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(52, 211, 153, 0.3)", backgroundColor: "rgba(52, 211, 153, 0.08)", color: "rgb(167, 243, 208)" }}
        >
          Verified. Your ID has been approved.
        </div>
      )}
      {mode === "submitted" && (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(245, 158, 11, 0.3)", backgroundColor: "rgba(245, 158, 11, 0.08)", color: "rgb(253, 224, 71)" }}
        >
          Submitted — pending review. We’ll update you when verification is complete.
        </div>
      )}

      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm"
        aria-label="Choose ID document"
      />

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
          {saving ? "Uploading..." : mode !== "not_started" ? "Update ID" : "Upload ID"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/csp/dashboard/application")}
          className="w-full py-3 rounded-xl text-sm font-medium border"
          style={{ borderColor: "rgba(248, 250, 252, 0.12)", color: CSP_TEXT_SECONDARY }}
        >
          Back to Application
        </button>
      </div>
    </div>
  );
}
