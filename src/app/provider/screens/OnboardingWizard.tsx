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

const ONBOARDING_PATH = "/csp/dashboard/onboarding";

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-900">{label}</label>
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
    if (!Number.isFinite(radius) || !isValidServiceRadiusMiles(radius))
      return setErr(`Service radius must be between ${SERVICE_RADIUS_MILES_MIN} and ${SERVICE_RADIUS_MILES_MAX} miles.`);

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

      // Durable onboarding_completed Kinex truth is emitted by the profile transition outbox trigger.
      // This screen owns user input and navigation only.
      const preferencesUpsert = await supabase
        .from("provider_preferences")
        .upsert(
          {
            provider_id: uid,
          },
          { onConflict: "provider_id" }
        );
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
    traceCspFlow("onboarding", {
      branch: "onboarding.loading",
      reason: "flow_profile_loading",
      pathname: ONBOARDING_PATH,
      uid: uid ?? null,
      profileId: profileFlow?.id ?? null,
    });
    return <CspNeutralLoading />;
  }

  if (!uid) {
    traceCspFlow("onboarding", {
      branch: "onboarding.redirect.login",
      reason: "missing_uid",
      pathname: ONBOARDING_PATH,
      uid: null,
      target: "/csp/login",
    });
    return <Navigate to="/csp/login" replace />;
  }

  if (!profileFlow || profileFlow.id !== uid) {
    traceCspFlow("onboarding", {
      branch: "onboarding.loading",
      reason: "flow_profile_missing",
      pathname: ONBOARDING_PATH,
      uid,
      profileId: profileFlow?.id ?? null,
    });
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 text-center text-slate-700">
          <p className="text-sm mb-4">Could not load your profile for setup.</p>
          <button
            type="button"
            className="h-11 w-full rounded-xl bg-black text-white text-sm font-medium"
            onClick={() => void refreshFlowProfile()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (profileFlow.role === "admin") {
    return <Navigate to="/csp/dashboard" replace />;
  }

  const flowForDecision = mergeFlowProfileWithHandoffs(profileFlow, uid);

  const flowTarget = getCspFlowRedirectTarget(ONBOARDING_PATH, flowForDecision);
  if (flowTarget && flowTarget !== ONBOARDING_PATH) {
    traceCspFlow("onboarding", {
      branch: "onboarding.redirect.flow-target",
      reason: "resolver_model",
      pathname: ONBOARDING_PATH,
      uid,
      profileId: profileFlow.id,
      target: flowTarget,
    });
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

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">Provider Setup</h1>
          <p className="text-sm text-gray-600">
            Set your service area so you can start accepting jobs.
          </p>
        </div>

        {err ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          <Field label="Full name">
            <input
              className="h-11 rounded-xl border px-3 text-black placeholder-gray-400 outline-none focus:ring-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g., Shine Williams"
            />
          </Field>

          <Field label="Phone (optional)">
            <input
              className="h-11 rounded-xl border px-3 text-black placeholder-gray-400 outline-none focus:ring-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., (404) 123-4567"
            />
          </Field>

          <Field label="ZIP code">
            <input
              className="h-11 rounded-xl border px-3 text-black placeholder-gray-400 outline-none focus:ring-2"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="e.g., 30318"
            />
          </Field>

          <Field label={`Service radius (miles): ${radius}`}>
            <input
              className="w-full"
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
          </Field>

          <button
            type="button"
            className="mt-2 h-11 rounded-xl bg-black text-white disabled:opacity-50"
            onClick={handleFinish}
            disabled={saving}
          >
            {saving ? "Saving…" : "Finish setup"}
          </button>
        </div>
      </div>
    </div>
  );
}
