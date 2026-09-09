import { useState, useEffect } from "react";
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

const NEXT_STEP_PATH = "/csp/dashboard/verification";

const TRANSPORT_OPTIONS: { value: string; label: string }[] = [
  { value: "personal_vehicle", label: "My own car" },
  { value: "rideshare", label: "Rideshare" },
  { value: "public_transit", label: "Bus or train" },
  { value: "mixed", label: "A mix" },
  { value: "other", label: "Other" },
];

function stepMode(status: string | null | undefined): "not_started" | "submitted" | "completed" {
  if (!status) return "not_started";
  const n = status.toLowerCase();
  if (n === "completed") return "completed";
  if (n === "submitted") return "submitted";
  return "not_started";
}

export default function TransportationReadinessScreen() {
  const navigate = useNavigate();
  const { profile, refresh } = useProfile();
  const [transportMode, setTransportMode] = useState<string>("");
  const [canTransportSupplies, setCanTransportSupplies] = useState<boolean>(false);
  const [prefersLocalJobsOnly, setPrefersLocalJobsOnly] = useState<boolean>(false);
  const [travelConstraints, setTravelConstraints] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = stepMode(profile?.travel_readiness_status);

  useEffect(() => {
    if (!profile) return;
    setTransportMode(profile.transport_mode ?? "");
    setCanTransportSupplies(profile.can_transport_supplies ?? false);
    setPrefersLocalJobsOnly(profile.prefers_local_jobs_only ?? false);
    setTravelConstraints(profile.travel_constraints ?? "");
  }, [profile]);

  async function handleSave() {
    if (!profile) return;
    if (!transportMode.trim()) {
      setError("Choose how you usually get to jobs.");
      return;
    }

    setSaving(true);
    setError(null);

    const rpcPayload = {
      p_transport_mode: transportMode.trim(),
      p_can_transport_supplies: canTransportSupplies,
      p_travel_constraints: travelConstraints.trim() || null,
      p_prefers_local_jobs_only: prefersLocalJobsOnly,
    };
    const traceRpc = await traceProfileWriteStart({
      source: "TransportationReadinessScreen.handleSave:submit_transportation_readiness",
      operation: "rpc",
      targetId: profile.id,
      payload: rpcPayload,
      cspFlowState: { travel_readiness_status: profile.travel_readiness_status },
    });
    const submitResult = await supabase.rpc("submit_transportation_readiness", rpcPayload);
    traceProfileWriteResult(traceRpc, submitResult);

    if (submitResult.error) {
      setError(submitResult.error.message);
      setSaving(false);
      return;
    }

    try {
      await refresh();
    } catch {
      // Non-blocking: the RPC already persisted transportation readiness.
    }
    setSaving(false);
    navigate(NEXT_STEP_PATH, { replace: true });
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_TEXT_SECONDARY }}>
          Provider setup · Getting to jobs
        </p>
        <h1 className="text-2xl font-semibold">Getting to jobs</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Tell us how you get to jobs. After you save, we&apos;ll take you to the last review.
        </p>
      </header>

      {mode === "completed" && (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(52, 211, 153, 0.3)", backgroundColor: "rgba(52, 211, 153, 0.08)", color: "rgb(167, 243, 208)" }}>
          Your travel setup is done.
        </div>
      )}
      {mode === "submitted" && (
        <div className="mb-4 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(245, 158, 11, 0.3)", backgroundColor: "rgba(245, 158, 11, 0.08)", color: "rgb(253, 224, 71)" }}>
          We saved your travel answers. You can change them before you move on.
        </div>
      )}

      <div className="space-y-5" style={{ marginBottom: CSP_SECTION_GAP }}>
        <div>
          <p className="text-sm font-medium mb-2" style={{ color: CSP_TEXT_SECONDARY }}>
            How do you usually get to jobs?
          </p>
          <div className="space-y-2">
            {TRANSPORT_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer" style={{ color: CSP_TEXT_PRIMARY }}>
                <input type="radio" name="transport_mode" value={opt.value} checked={transportMode === opt.value} onChange={() => setTransportMode(opt.value)} className="rounded-full border-white/20" />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer" style={{ color: CSP_TEXT_PRIMARY }}>
          <input type="checkbox" checked={canTransportSupplies} onChange={(e) => setCanTransportSupplies(e.target.checked)} className="rounded border-white/20" />
          <span className="text-sm">I can bring my own cleaning supplies to jobs</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer" style={{ color: CSP_TEXT_PRIMARY }}>
          <input type="checkbox" checked={prefersLocalJobsOnly} onChange={(e) => setPrefersLocalJobsOnly(e.target.checked)} className="rounded border-white/20" />
          <span className="text-sm">I only want jobs close to me</span>
        </label>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: CSP_TEXT_SECONDARY }}>
            Anything that can make travel or parking hard? (optional)
          </label>
          <textarea value={travelConstraints} onChange={(e) => setTravelConstraints(e.target.value)} placeholder="For example: hard parking, stairs, or places you cannot travel to" rows={3} maxLength={1000} className="w-full rounded-xl border bg-white/5 px-3 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/20" style={{ borderColor: "rgba(248, 250, 252, 0.12)", color: CSP_TEXT_PRIMARY }} />
        </div>
      </div>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <div className="grid gap-3">
        <button type="button" onClick={handleSave} disabled={saving || !transportMode.trim()} className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
          {saving ? "Saving..." : mode !== "not_started" ? "Save and review" : "Save and continue"}
        </button>
        <button type="button" onClick={() => navigate("/csp/dashboard/application")} className="w-full py-3 rounded-xl text-sm font-medium border" style={{ borderColor: "rgba(248, 250, 252, 0.12)", color: CSP_TEXT_SECONDARY }}>
          Back to setup steps
        </button>
      </div>
    </div>
  );
}
