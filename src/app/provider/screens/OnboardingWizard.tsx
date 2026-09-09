import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useCspFlowProfile } from "@/hooks/useCspFlowProfile";
import { CspNeutralLoading } from "../components/CspNeutralLoading";
import {
  SERVICE_RADIUS_MILES_MIN,
  SERVICE_RADIUS_MILES_MAX,
  clampServiceRadiusMiles,
  isValidServiceRadiusMiles,
} from "../../../config/serviceArea";
import { traceCspFlow } from "@/lib/cspFlowTrace";
import { getCspFlowRedirectTarget } from "@/lib/providerFlow";
import { mergeFlowProfileWithHandoffs, setOnboardingCompleteHandoff } from "@/lib/cspFlowHandoff";
import { traceProfileWriteStart, traceProfileWriteResult } from "@/lib/debug/profileWriteTrace";
import {
  CSP_PRIMARY_BUTTON,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

const ONBOARDING_PATH = "/csp/dashboard/onboarding";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium" style={{ color: CSP_TEXT_SECONDARY }}>{label}</label>
      {children}
    </div>
  );
}

export default function OnboardingWizard() {
  const { uid, loading: flowLoading, profileFlow, refreshFlowProfile } = useCspFlowProfile();
  const navigate = useNavigate();

  const initial = useMemo(
    () => ({
      full_name: profileFlow?.full_name ?? "",
      phone: profileFlow?.phone ?? "",
      zip_code: profileFlow?.zip_code ?? "",
      service_radius_miles: clampServiceRadiusMiles(profileFlow?.service_radius_miles ?? 15) ?? 15,
    }),
    [profileFlow]
  );

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [radius, setRadius] = useState<number>(15);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setFullName(initial.full_name);
    setPhone(initial.phone);
    setZip(initial.zip_code);
    setRadius(initial.service_radius_miles);
  }, [initial]);

  async function handleFinish() {
    setErr(null);
    if (!fullName.trim()) return setErr("Please enter your full name.");
    if (!zip.trim()) return setErr("Please enter your ZIP code.");
    if (!Number.isFinite(radius) || !isValidServiceRadiusMiles(radius)) {
      return setErr(`Service radius must be between ${SERVICE_RADIUS_MILES_MIN} and ${SERVICE_RADIUS_MILES_MAX} miles.`);
    }
    if (!uid || !profileFlow) return;

    setSaving(true);
    setErr(null);
    const zipTrimmed = zip.trim();
    const fullNameTrimmed = fullName.trim();
    const phoneValue = phone.trim() || null;

    try {
      const radiusToSave = clampServiceRadiusMiles(radius) ?? SERVICE_RADIUS_MILES_MIN;
      const cspFlowSnap = {
        is_onboarded: profileFlow.is_onboarded,
        application_status: profileFlow.application_status,
        identity_status: profileFlow.identity_status,
        readiness_status: profileFlow.readiness_status,
        provider_interest_submitted_at: profileFlow.provider_interest_submitted_at,
      } as Record<string, unknown>;
      const rpcPayload = {
        p_full_name: fullNameTrimmed,
        p_phone: phoneValue,
        p_zip: zipTrimmed,
        p_service_radius_miles: radiusToSave,
      };
      const traceRpc = await traceProfileWriteStart({
        source: "OnboardingWizard.handleFinish:complete_csp_onboarding",
        operation: "rpc",
        targetId: uid,
        payload: rpcPayload,
        pathname: ONBOARDING_PATH,
        cspFlowState: cspFlowSnap,
      });
      const onboardingResult = await supabase.rpc("complete_csp_onboarding", rpcPayload);
      traceProfileWriteResult(traceRpc, onboardingResult);
      if (onboardingResult.error) throw new Error(onboardingResult.error.message);

      traceCspFlow("onboarding", {
        branch: "onboarding.write.complete",
        reason: "onboarding_rpc_success",
        pathname: ONBOARDING_PATH,
        uid,
        profileId: uid,
        is_onboarded: true,
        waiver_accepted_at: profileFlow.waiver_accepted_at ?? null,
      });

      const preferencesUpsert = await supabase
        .from("provider_preferences")
        .upsert({ provider_id: uid }, { onConflict: "provider_id" });
      if (preferencesUpsert.error) throw new Error(preferencesUpsert.error.message);

      setOnboardingCompleteHandoff(uid);
      traceCspFlow("onboarding", {
        branch: "onboarding.complete.navigate-verification",
        reason: "submit_success",
        pathname: ONBOARDING_PATH,
        uid,
        profileId: uid,
        handoffOnboardingComplete: true,
        target: "/csp/dashboard/verification",
      });
      navigate("/csp/dashboard/verification", { replace: true });
      void refreshFlowProfile();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Setup failed";
      if (message.startsWith("zip_not_cached") || message.includes("zip_not_cached")) {
        setErr("This ZIP code is outside our current provider coverage zone. Cleanr is currently onboarding providers in the Metro Atlanta area only.");
      } else if (message.startsWith("outside_service_area")) {
        setErr("Cleanr currently services Metro Atlanta only.");
      } else if (message.startsWith("service_radius_out_of_range") || message.includes("service_radius_out_of_range")) {
        setErr(`Service radius must be between ${SERVICE_RADIUS_MILES_MIN} and ${SERVICE_RADIUS_MILES_MAX} miles.`);
      } else {
        setErr(message);
      }
    } finally {
      setSaving(false);
    }
  }

  if (flowLoading) {
    traceCspFlow("onboarding", { branch: "onboarding.loading", reason: "flow_profile_loading", pathname: ONBOARDING_PATH, uid: uid ?? null, profileId: profileFlow?.id ?? null });
    return <CspNeutralLoading />;
  }

  if (!uid) {
    traceCspFlow("onboarding", { branch: "onboarding.redirect.login", reason: "missing_uid", pathname: ONBOARDING_PATH, uid: null, target: "/csp/login" });
    return <Navigate to="/csp/login" replace />;
  }

  if (!profileFlow || profileFlow.id !== uid) {
    traceCspFlow("onboarding", { branch: "onboarding.loading", reason: "flow_profile_missing", pathname: ONBOARDING_PATH, uid, profileId: profileFlow?.id ?? null });
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6" style={{ color: CSP_TEXT_PRIMARY }}>
        <div className="w-full max-w-md text-center">
          <p className="text-sm mb-4" style={{ color: CSP_TEXT_SECONDARY }}>Could not load your profile for setup.</p>
          <button type="button" className="h-11 w-full rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }} onClick={() => void refreshFlowProfile()}>Retry</button>
        </div>
      </div>
    );
  }

  if (profileFlow.role === "admin") return <Navigate to="/csp/dashboard" replace />;

  const flowForDecision = mergeFlowProfileWithHandoffs(profileFlow, uid);
  const flowTarget = getCspFlowRedirectTarget(ONBOARDING_PATH, flowForDecision);
  if (flowTarget && flowTarget !== ONBOARDING_PATH) {
    traceCspFlow("onboarding", { branch: "onboarding.redirect.flow-target", reason: "resolver_model", pathname: ONBOARDING_PATH, uid, profileId: profileFlow.id, target: flowTarget });
    return <Navigate to={flowTarget} replace />;
  }

  traceCspFlow("onboarding", {
    branch: "onboarding.render.wizard",
    reason: "not_onboarded",
    pathname: ONBOARDING_PATH,
    uid,
    profileId: profileFlow.id,
    provider_interest_submitted_at: profileFlow.provider_interest_submitted_at,
    is_onboarded: profileFlow.is_onboarded,
    waiver_accepted_at: profileFlow.waiver_accepted_at,
    identity_status: profileFlow.identity_status,
    readiness_status: profileFlow.readiness_status,
    application_status: profileFlow.application_status,
    application_submitted_at: profileFlow.application_submitted_at,
    marketplace_access: profileFlow.marketplace_access,
    target: null,
  });

  const inputClass = "h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-base text-white placeholder:text-slate-500 outline-none focus:border-[#0A84FF]/60 focus:ring-2 focus:ring-[#0A84FF]/20";

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: CSP_TEXT_SECONDARY }}>Provider setup</p>
        <h1 className="mt-2 text-2xl font-semibold">Set your service area</h1>
        <p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Tell Cleanr where you work. You can update your availability later.</p>
      </header>

      {err ? <div className="mb-5 rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">{err}</div> : null}

      <div className="space-y-5">
        <Field label="Full name">
          <input className={inputClass} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Shine Williams" autoComplete="name" />
        </Field>

        <Field label="Phone · optional">
          <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(404) 123-4567" autoComplete="tel" inputMode="tel" />
        </Field>

        <Field label="Home ZIP code">
          <input className={inputClass} value={zip} onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))} placeholder="30318" inputMode="numeric" autoComplete="postal-code" />
        </Field>

        <section className="border-y border-white/10 py-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Service radius</p>
              <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>How far you normally want to travel from your home ZIP.</p>
            </div>
            <p className="text-lg font-semibold">{radius} mi</p>
          </div>
          <input
            className="mt-4 w-full accent-[#0A84FF]"
            type="range"
            min={SERVICE_RADIUS_MILES_MIN}
            max={SERVICE_RADIUS_MILES_MAX}
            value={radius}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              setRadius(clampServiceRadiusMiles(next) ?? SERVICE_RADIUS_MILES_MIN);
            }}
          />
          <div className="mt-1 flex justify-between text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}>
            <span>{SERVICE_RADIUS_MILES_MIN} mi</span><span>{SERVICE_RADIUS_MILES_MAX} mi</span>
          </div>
        </section>

        <button type="button" className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }} onClick={handleFinish} disabled={saving}>
          {saving ? "Saving…" : "Continue to final review"}
        </button>
      </div>
    </div>
  );
}
