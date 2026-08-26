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
      pathname: "/csp/dashboard/verification",
      uid,
    });
    return <CspNeutralLoading />;
  }
  if (!uid) return <Navigate to="/csp/login" replace />;
  if (!profileFlow || profileFlow.role !== "csp") return <Navigate to={DASHBOARD_PATH} replace />;

  const merged = mergeFlowProfileWithHandoffs(profileFlow, uid);
  const flowTarget = getCspFlowRedirectTarget(VERIFICATION_PATH, merged);
  if (flowTarget && flowTarget !== VERIFICATION_PATH) {
    traceCspFlow("verification", {
      branch: "verification.redirect.flow-target",
      reason: "not_eligible_for_step",
      pathname: VERIFICATION_PATH,
      uid,
      profileId: profileFlow.id,
      handoffInterestSubmitted: hasProviderInterestHandoff(uid),
      handoffOnboardingComplete: hasOnboardingCompleteHandoff(uid),
      mergedIsOnboarded: merged.is_onboarded === true,
      mergedWaiverAccepted: hasProviderInterestAtValue(merged.waiver_accepted_at),
      provider_interest_submitted_at: profileFlow.provider_interest_submitted_at ?? null,
      is_onboarded: profileFlow.is_onboarded,
      target: flowTarget,
    });
    return <Navigate to={flowTarget} replace />;
  }

  traceCspFlow("verification", {
    branch: "verification.render.form",
    reason: "eligible",
    pathname: VERIFICATION_PATH,
    uid,
    profileId: profileFlow.id,
    handoffInterestSubmitted: hasProviderInterestHandoff(uid),
    handoffOnboardingComplete: hasOnboardingCompleteHandoff(uid),
    mergedIsOnboarded: merged.is_onboarded === true,
    mergedWaiverAccepted: hasProviderInterestAtValue(merged.waiver_accepted_at),
    provider_interest_submitted_at: profileFlow.provider_interest_submitted_at ?? null,
    is_onboarded: profileFlow.is_onboarded,
    waiver_accepted_at: profileFlow.waiver_accepted_at ?? null,
    identity_status: profileFlow.identity_status ?? null,
    readiness_status: profileFlow.readiness_status ?? null,
    application_status: profileFlow.application_status ?? null,
    application_submitted_at: profileFlow.application_submitted_at ?? null,
    application_approved_at: profileFlow.application_approved_at ?? null,
    marketplace_access: profileFlow.marketplace_access,
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
    const submittedAt = new Date().toISOString();
    const verifyPayload = {
      identity_status: "submitted",
      readiness_status: "submitted",
      application_status: "under_review",
      application_submitted_at: submittedAt,
    };
    const traceUpd = await traceProfileWriteStart({
      source: "ProviderVerificationScreen.submitApplication",
      operation: "update",
      targetId: uid,
      payload: verifyPayload,
      pathname: VERIFICATION_PATH,
      cspFlowState: profileFlow
        ? ({
            identity_status: profileFlow.identity_status,
            readiness_status: profileFlow.readiness_status,
            application_status: profileFlow.application_status,
            is_onboarded: profileFlow.is_onboarded,
          } as Record<string, unknown>)
        : null,
    });
    const updateResult = await supabase.from("profiles").update(verifyPayload).eq("id", uid);
    traceProfileWriteResult(traceUpd, updateResult);
    const { error: upErr } = updateResult;
    if (upErr) {
      setError(upErr.message);
      setSaving(false);
      return;
    }
    traceCspFlow("verification", {
      branch: "verification.write.submitted",
      reason: "profile_update_success",
      pathname: VERIFICATION_PATH,
      uid,
      profileId: uid,
      identity_status: "submitted",
      readiness_status: "submitted",
      application_status: "under_review",
      application_submitted_at: submittedAt,
      submitSource: "explicit_submit_button",
    });
    await refreshFlowProfile();
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
