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
  if (["completed", "waived", "approved", "verified", "clear"].includes(n)) return "completed";
  if (["scheduled", "submitted", "under_review", "pending", "in_progress"].includes(n)) return "submitted";
  return "not_started";
}

export default function ScreeningScreen() {
  const navigate = useNavigate();
  const { profile, refresh } = useProfile();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mode = stepMode(profile?.screening_status);

  async function handleSubmitForReview() {
    if (!profile) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    const scrPayload = { screening_status: "scheduled" };
    const traceUpd = await traceProfileWriteStart({
      source: "ScreeningScreen.handleSubmitForReview",
      operation: "update",
      targetId: profile.id,
      payload: scrPayload,
      cspFlowState: { screening_status: profile.screening_status },
    });
    const updateResult = await supabase.from("profiles").update(scrPayload).eq("id", profile.id);
    traceProfileWriteResult(traceUpd, updateResult);
    const { error: updateError } = updateResult;
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    await refresh();
    setSaving(false);
    navigate("/csp/dashboard/application/screening-submitted");
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Final screening</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Complete screening to unlock jobs and payouts.
        </p>
      </header>

      {mode === "completed" && (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(52, 211, 153, 0.3)", backgroundColor: "rgba(52, 211, 153, 0.08)", color: "rgb(167, 243, 208)" }}
        >
          Screening complete. You’re all set for this step.
        </div>
      )}
      {mode === "submitted" && (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(245, 158, 11, 0.3)", backgroundColor: "rgba(245, 158, 11, 0.08)", color: "rgb(253, 224, 71)" }}
        >
          Submitted — under review. We’ll update you when screening is complete.
        </div>
      )}

      <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        We currently review screening manually. Schedule placeholder is active until automation is enabled.
      </p>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-emerald-300">{message}</p> : null}

      <div className="mt-6 grid gap-3">
        {mode === "not_started" ? (
          <button
            type="button"
            onClick={handleSubmitForReview}
            disabled={saving}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          >
            {saving ? "Saving..." : "Submit Screening"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/csp/dashboard/application-status")}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          >
            View Status
          </button>
        )}
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
