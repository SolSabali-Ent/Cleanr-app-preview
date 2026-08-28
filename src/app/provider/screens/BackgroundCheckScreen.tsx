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

function stepMode(status: string | null | undefined): "not_started" | "submitted" | "completed" {
  if (!status) return "not_started";
  const n = status.toLowerCase();
  if (["approved", "verified", "clear", "completed"].includes(n)) return "completed";
  if (["submitted", "under_review", "pending"].includes(n)) return "submitted";
  return "not_started";
}

export default function BackgroundCheckScreen() {
  const navigate = useNavigate();
  const { profile, refresh } = useProfile();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mode = stepMode(profile?.background_check_status);

  async function handleSubmit() {
    if (!profile) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    const traceRpc = await traceProfileWriteStart({
      source: "BackgroundCheckScreen.handleSubmit:submit_background_check_step",
      operation: "rpc",
      targetId: profile.id,
      payload: {},
      cspFlowState: { background_check_status: profile.background_check_status },
    });
    const submitResult = await supabase.rpc("submit_background_check_step");
    traceProfileWriteResult(traceRpc, submitResult);
    if (submitResult.error) {
      setError(submitResult.error.message);
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
        <h1 className="text-2xl font-semibold">Background check</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Approval protects customers and protects you.
        </p>
      </header>

      {mode === "completed" && (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(52, 211, 153, 0.3)", backgroundColor: "rgba(52, 211, 153, 0.08)", color: "rgb(167, 243, 208)" }}
        >
          Completed. Your background check has been approved.
        </div>
      )}
      {mode === "submitted" && (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(245, 158, 11, 0.3)", backgroundColor: "rgba(245, 158, 11, 0.08)", color: "rgb(253, 224, 71)" }}
        >
          Submitted — pending review. We’ll update you when review is complete.
        </div>
      )}

      <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        Background checks are reviewed by admin. Submit this step to move your application forward.
      </p>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-emerald-300">{message}</p> : null}

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
        >
          {saving ? "Saving..." : mode !== "not_started" ? "Update Background Check" : "Submit Background Check"}
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
