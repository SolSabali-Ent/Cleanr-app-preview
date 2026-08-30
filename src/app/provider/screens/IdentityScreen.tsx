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

const NEXT_STEP_PATH = "/csp/dashboard/application/background";

function stepMode(
  status: string | null | undefined,
  documentPath: string | null | undefined
): "not_started" | "submitted" | "completed" {
  const hasDocument = Boolean(documentPath?.trim());
  if (!status || !hasDocument) return "not_started";
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
  const [error, setError] = useState<string | null>(null);
  const mode = stepMode(profile?.identity_status, profile?.identity_document_path);

  async function handleUpload() {
    if (!profile || !file) {
      setError("Please choose a file.");
      return;
    }
    setSaving(true);
    setError(null);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `providers/${profile.id}/identity/${Date.now()}-${safeName}`;

    const upload = await supabase.storage.from("provider-documents").upload(path, file, { upsert: true });
    if (upload.error) {
      setError(upload.error.message);
      setSaving(false);
      return;
    }

    const rpcPayload = { p_document_path: path };
    const traceRpc = await traceProfileWriteStart({
      source: "IdentityScreen.handleSubmit:submit_identity_document",
      operation: "rpc",
      targetId: profile.id,
      payload: rpcPayload,
      cspFlowState: { identity_status: profile.identity_status, application_status: profile.application_status },
    });
    const submitResult = await supabase.rpc("submit_identity_document", rpcPayload);
    traceProfileWriteResult(traceRpc, submitResult);
    if (submitResult.error) {
      setError(submitResult.error.message);
      setSaving(false);
      return;
    }

    try {
      await refresh();
    } catch {
      // Non-blocking: the submission RPC already persisted the document path.
    }
    setSaving(false);
    navigate(NEXT_STEP_PATH, { replace: true });
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_TEXT_SECONDARY }}>
          Provider setup · ID verification
        </p>
        <h1 className="text-2xl font-semibold">Verify your identity</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Upload a government-issued ID. Once it’s saved, we’ll take you straight to the background-check step.
        </p>
      </header>

      {mode === "completed" && (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(52, 211, 153, 0.3)", backgroundColor: "rgba(52, 211, 153, 0.08)", color: "rgb(167, 243, 208)" }}>
          Verified. Your ID has been approved.
        </div>
      )}
      {mode === "submitted" && (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(245, 158, 11, 0.3)", backgroundColor: "rgba(245, 158, 11, 0.08)", color: "rgb(253, 224, 71)" }}>
          Your ID is already submitted. You can replace it below if needed.
        </div>
      )}
      {profile?.identity_status && mode === "not_started" ? (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(245, 158, 11, 0.3)", backgroundColor: "rgba(245, 158, 11, 0.08)", color: "rgb(253, 224, 71)" }}>
          Your prior status does not include a stored ID document. Please upload your ID to complete this step.
        </div>
      ) : null}

      <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" aria-label="Choose ID document" />

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-6 grid gap-3">
        <button type="button" onClick={handleUpload} disabled={saving || !file} className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
          {saving ? "Uploading..." : mode !== "not_started" ? "Save ID and continue" : "Upload ID and continue"}
        </button>
        <button type="button" onClick={() => navigate("/csp/dashboard/application")} className="w-full py-3 rounded-xl text-sm font-medium border" style={{ borderColor: "rgba(248, 250, 252, 0.12)", color: CSP_TEXT_SECONDARY }}>
          View application checklist
        </button>
      </div>
    </div>
  );
}
