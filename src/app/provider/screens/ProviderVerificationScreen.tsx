import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useCspFlowProfile } from "@/hooks/useCspFlowProfile";
import {
  hasOnboardingCompleteHandoff,
  hasProviderInterestHandoff,
  mergeFlowProfileWithHandoffs,
} from "@/lib/cspFlowHandoff";
import { traceCspFlow } from "@/lib/cspFlowTrace";
import { getCspFlowRedirectTarget, hasProviderInterestAtValue } from "@/lib/providerFlow";
import { CspNeutralLoading } from "../components/CspNeutralLoading";
import { CSP_PRIMARY_BUTTON, CSP_TEXT_PRIMARY, CSP_TEXT_SECONDARY } from "@/theme/cspTheme";
import { traceProfileWriteStart, traceProfileWriteResult } from "@/lib/debug/profileWriteTrace";

const VERIFICATION_PATH = "/csp/dashboard/verification";
const APPLICATION_STATUS_PATH = "/csp/dashboard/application-status";
const DASHBOARD_PATH = "/csp/dashboard";

type ProviderApplicationSubmissionResult = {
  identity_status?: string | null;
  readiness_status?: string | null;
  application_status?: string | null;
  application_submitted_at?: string | null;
};

export default function ProviderVerificationScreen() {
  const navigate = useNavigate();
  const { uid, loading, profileFlow, refreshFlowProfile } = useCspFlowProfile();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedReady, setConfirmedReady] = useState(false);

  if (loading) {
    traceCspFlow("verification", {
      branch: "verification.loading",
      reason: "flow_loading",
      pathname: VERIFICATION_PATH,
      uid,
    });
    return <CspNeutralLoading />;
  }
  if (!uid) return <Navigate to="/csp/login" replace />;
  if (!profileFlow || profileFlow.role !== "csp") return <Navigate to={DASHBOARD_PATH} replace />;

  // Bind the narrowed profile to this render. TypeScript does not preserve the nullable hook-value
  // narrowing across the async submit closure, while this immutable render snapshot does.
  const currentProfileFlow = profileFlow;
  const merged = mergeFlowProfileWithHandoffs(currentProfileFlow, uid);
  const flowTarget = getCspFlowRedirectTarget(VERIFICATION_PATH, merged);
  if (flowTarget && flowTarget !== VERIFICATION_PATH) {
    traceCspFlow("verification", {
      branch: "verification.redirect.flow-target",
      reason: "not_eligible_for_step",
      pathname: VERIFICATION_PATH,
      uid,
      profileId: currentProfileFlow.id,
      handoffInterestSubmitted: hasProviderInterestHandoff(uid),
      handoffOnboardingComplete: hasOnboardingCompleteHandoff(uid),
      mergedIsOnboarded: merged.is_onboarded === true,
      mergedWaiverAccepted: hasProviderInterestAtValue(merged.waiver_accepted_at),
      provider_interest_submitted_at: currentProfileFlow.provider_interest_submitted_at ?? null,
      is_onboarded: currentProfileFlow.is_onboarded,
      target: flowTarget,
    });
    return <Navigate to={flowTarget} replace />;
  }

  traceCspFlow("verification", {
    branch: "verification.render.form",
    reason: "eligible",
    pathname: VERIFICATION_PATH,
    uid,
    profileId: currentProfileFlow.id,
    handoffInterestSubmitted: hasProviderInterestHandoff(uid),
    handoffOnboardingComplete: hasOnboardingCompleteHandoff(uid),
    mergedIsOnboarded: merged.is_onboarded === true,
    mergedWaiverAccepted: hasProviderInterestAtValue(merged.waiver_accepted_at),
    provider_interest_submitted_at: currentProfileFlow.provider_interest_submitted_at ?? null,
    is_onboarded: currentProfileFlow.is_onboarded,
    waiver_accepted_at: currentProfileFlow.waiver_accepted_at ?? null,
    identity_status: currentProfileFlow.identity_status ?? null,
    readiness_status: currentProfileFlow.readiness_status ?? null,
    application_status: currentProfileFlow.application_status ?? null,
    application_submitted_at: currentProfileFlow.application_submitted_at ?? null,
    application_approved_at: currentProfileFlow.application_approved_at ?? null,
    marketplace_access: currentProfileFlow.marketplace_access,
    target: null,
  });

  async function submitVerification() {
    if (!confirmedReady) {
      traceCspFlow("verification", {
        branch: "verification.submit.blocked_missing_confirmation",
        reason: "missing_confirmation",
        pathname: VERIFICATION_PATH,
        uid,
        profileId: uid,
        target: null,
      });
      return;
    }
    setSaving(true);
    setError(null);
    const traceRpc = await traceProfileWriteStart({
      source: "ProviderVerificationScreen.submitApplication:submit_provider_application",
      operation: "rpc",
      targetId: uid,
      payload: {},
      pathname: VERIFICATION_PATH,
      cspFlowState: {
        identity_status: currentProfileFlow.identity_status,
        readiness_status: currentProfileFlow.readiness_status,
        application_status: currentProfileFlow.application_status,
        is_onboarded: currentProfileFlow.is_onboarded,
      },
    });
    const submitResult = await supabase.rpc("submit_provider_application");
    traceProfileWriteResult(traceRpc, submitResult);
    if (submitResult.error) {
      setError(submitResult.error.message);
      setSaving(false);
      return;
    }
    const result = (submitResult.data ?? {}) as ProviderApplicationSubmissionResult;
    traceCspFlow("verification", {
      branch: "verification.write.submitted",
      reason: "application_submit_rpc_success",
      pathname: VERIFICATION_PATH,
      uid,
      profileId: uid,
      identity_status: result.identity_status ?? currentProfileFlow.identity_status ?? null,
      readiness_status: result.readiness_status ?? currentProfileFlow.readiness_status ?? null,
      application_status: result.application_status ?? "under_review",
      application_submitted_at: result.application_submitted_at ?? currentProfileFlow.application_submitted_at ?? null,
      submitSource: "explicit_submit_button",
    });
    await refreshFlowProfile();
    setSaving(false);
    traceCspFlow("verification", {
      branch: "verification.submit.navigate-application-status",
      reason: "submit_success",
      pathname: VERIFICATION_PATH,
      uid,
      profileId: uid,
      target: APPLICATION_STATUS_PATH,
    });
    navigate(APPLICATION_STATUS_PATH, { replace: true });
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <h1 className="text-2xl font-semibold">Identity and readiness verification</h1>
      <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
        Submit your verification package to move your application into review.
      </p>
      {error ? <p className="text-sm text-red-300 mt-3">{error}</p> : null}
      <label className="mt-6 flex items-start gap-3 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <input
          type="checkbox"
          checked={confirmedReady}
          onChange={(e) => setConfirmedReady(e.target.checked)}
          className="mt-0.5"
        />
        <span>I confirm this information is accurate and ready for Cleanr review.</span>
      </label>
      <button
        type="button"
        disabled={saving || !confirmedReady}
        onClick={() => void submitVerification()}
        className="mt-5 w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-60"
        style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
      >
        {saving ? "Submitting..." : "Submit verification"}
      </button>
    </div>
  );
}
