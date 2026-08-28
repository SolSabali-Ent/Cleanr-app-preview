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

export default function AgreementScreen() {
  const navigate = useNavigate();
  const { profile, refresh } = useProfile();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (!profile) return;
    setSaving(true);
    setError(null);
    const traceRpc = await traceProfileWriteStart({
      source: "AgreementScreen.handleAccept:accept_provider_service_agreement",
      operation: "rpc",
      targetId: profile.id,
      payload: {},
    });
    const acceptResult = await supabase.rpc("accept_provider_service_agreement");
    traceProfileWriteResult(traceRpc, acceptResult);
    if (acceptResult.error) {
      setError(acceptResult.error.message);
      setSaving(false);
      return;
    }
    await refresh();
    setSaving(false);
    navigate("/csp/dashboard/application/insurance");
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Service agreement</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          This protects customers and protects you on every booking.
        </p>
      </header>

      <section
        className="rounded-2xl border p-4"
        style={{ borderColor: "rgba(248, 250, 252, 0.08)" }}
      >
        <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
          You agree to show up on time, complete booked services professionally, and follow marketplace
          trust and safety standards.
        </p>
      </section>

      {error ? (
        <p className="mt-4 text-sm text-red-300">{error}</p>
      ) : null}

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={handleAccept}
          disabled={saving}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
        >
          {saving ? "Saving..." : "Save & Continue"}
        </button>
        <button
          type="button"
          onClick={() => navigate("/csp/dashboard/application")}
          className="w-full py-3 rounded-xl text-sm font-medium border"
          style={{ borderColor: "rgba(248, 250, 252, 0.12)", color: CSP_TEXT_SECONDARY }}
        >
          Back to Checklist
        </button>
      </div>
    </div>
  );
}
