import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useCspFlowProfile } from "@/hooks/useCspFlowProfile";
import {
  computeProviderReviewBand,
  CLEANING_EXPERIENCE_BUCKETS,
  type CleaningExperienceBucket,
} from "../../../lib/providerReadiness";
import { emitProviderInterestSubmitted } from "../../../lib/kinex/events";
import { traceCspFlow } from "@/lib/cspFlowTrace";
import {
  getCspFlowRedirectTarget,
  hasProviderInterestSubmitted,
} from "@/lib/providerFlow";
import { hasProviderInterestHandoff, mergeFlowProfileWithHandoffs, setProviderInterestHandoff } from "@/lib/cspFlowHandoff";
import { CspNeutralLoading } from "../components/CspNeutralLoading";
import { traceProfileWriteStart, traceProfileWriteResult } from "@/lib/debug/profileWriteTrace";
import {
  CSP_PRIMARY_BUTTON,
  CSP_SECTION_GAP,
  CSP_SURFACE,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

const CANDIDATE_PATH = "/csp/dashboard/candidate-readiness";

const EXPERIENCE_LABELS: Record<CleaningExperienceBucket, string> = {
  lt_1y: "Less than 1 year",
  "1_3y": "1–3 years",
  "3_5y": "3–5 years",
  "5y_plus": "5+ years",
};

export default function CandidateReadinessScreen() {
  const navigate = useNavigate();
  const { uid, loading: flowLoading, profileFlow, refreshFlowProfile } = useCspFlowProfile();
  const [bucket, setBucket] = useState<CleaningExperienceBucket | "">("");
  const [hasEquipment, setHasEquipment] = useState<boolean | null>(null);
  const [hasTransport, setHasTransport] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (flowLoading || !uid) {
    traceCspFlow("candidate-readiness", {
      branch: "candidate.loading",
      reason: flowLoading ? "flow_profile_loading" : "missing_uid",
      pathname: CANDIDATE_PATH,
      uid: uid ?? null,
    });
    return <CspNeutralLoading />;
  }

  if (!profileFlow || profileFlow.id !== uid) {
    traceCspFlow("candidate-readiness", {
      branch: "candidate.loading",
      reason: "profile_missing",
      pathname: CANDIDATE_PATH,
      uid,
    });
    return (
      <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
        <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
          We couldn&apos;t load your provider profile. You&apos;re still signed in — try again, or contact support if
          this keeps happening.
        </p>
        <button
          type="button"
          className="mt-4 w-full py-3 rounded-xl text-white text-sm font-semibold"
          style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          onClick={() => void refreshFlowProfile()}
        >
          Retry
        </button>
        <button
          type="button"
          className="mt-3 w-full py-3 rounded-xl text-sm font-medium border"
          style={{ borderColor: "rgba(248, 250, 252, 0.12)", color: CSP_TEXT_SECONDARY }}
          onClick={() => navigate("/csp/login", { replace: true })}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  const profile = profileFlow;
  if (profile.role !== "csp") {
    traceCspFlow("candidate-readiness", {
      branch: "candidate.redirect.login",
      reason: "not_csp",
      pathname: CANDIDATE_PATH,
      uid,
      profileId: profile.id,
      target: "/csp/login",
    });
    return <Navigate to="/csp/login" replace />;
  }

  const handoffBefore = hasProviderInterestHandoff(uid);
  const flowForDecision = mergeFlowProfileWithHandoffs(profile, uid);

  const forwardTarget = getCspFlowRedirectTarget(CANDIDATE_PATH, flowForDecision);

  if (forwardTarget && forwardTarget !== CANDIDATE_PATH) {
    const dbInterest = hasProviderInterestSubmitted(profile);
    if (forwardTarget === "/csp/dashboard/onboarding" && dbInterest && uid) {
      setProviderInterestHandoff(uid);
      traceCspFlow("candidate-readiness", {
        branch: "candidate.set-handoff.interest-exists",
        reason: "interest_from_db_before_onboarding_redirect",
        pathname: CANDIDATE_PATH,
        uid,
        profileId: profile.id,
        provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null,
        handoffBefore,
        handoffAfter: hasProviderInterestHandoff(uid),
        computedInterestSubmitted: hasProviderInterestSubmitted(flowForDecision),
        target: forwardTarget,
      });
    }
    const redirectBranch =
      forwardTarget === "/csp/dashboard/onboarding"
        ? "candidate.redirect.onboarding"
        : "candidate.redirect.forward";
    traceCspFlow("candidate-readiness", {
      branch: redirectBranch,
      reason: "flow_target",
      pathname: CANDIDATE_PATH,
      uid,
      profileId: profile.id,
      provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null,
      handoffBefore,
      handoffAfter: hasProviderInterestHandoff(uid),
      computedInterestSubmitted: hasProviderInterestSubmitted(flowForDecision),
      is_onboarded: profile.is_onboarded,
      application_status: profile.application_status,
      application_submitted_at: profile.application_submitted_at,
      marketplace_access: profile.marketplace_access,
      target: forwardTarget,
    });
    return <Navigate to={forwardTarget} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!bucket) {
      setError("Please select how long you have been cleaning professionally.");
      return;
    }
    if (hasEquipment === null) {
      setError("Please answer whether you have your own equipment and supplies.");
      return;
    }
    if (hasTransport === null) {
      setError("Please answer whether you have reliable transportation.");
      return;
    }

    const submittedAt = new Date().toISOString();

    setSaving(true);
    const interestPayload = { provider_interest_submitted_at: submittedAt };
    const traceUpd = await traceProfileWriteStart({
      source: "CandidateReadinessScreen.submitInterest",
      operation: "update",
      targetId: profile.id,
      payload: interestPayload,
      pathname: CANDIDATE_PATH,
      cspFlowState: {
        provider_interest_submitted_at: profile.provider_interest_submitted_at,
        is_onboarded: profile.is_onboarded,
        application_status: profile.application_status,
      },
    });
    const updateResult = await supabase.from("profiles").update(interestPayload).eq("id", profile.id);
    traceProfileWriteResult(traceUpd, updateResult);
    const { error: updateError } = updateResult;

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    traceCspFlow("candidate-readiness", {
      branch: "candidate.write.interest",
      reason: "profile_update_success",
      pathname: CANDIDATE_PATH,
      uid,
      profileId: profile.id,
      provider_interest_submitted_at: submittedAt,
    });

    const submitHandoffBefore = hasProviderInterestHandoff(uid);
    if (uid) {
      setProviderInterestHandoff(uid);
      traceCspFlow("candidate-readiness", {
        branch: "candidate.set-handoff.interest-after-submit",
        reason: "submit_success",
        pathname: CANDIDATE_PATH,
        uid,
        profileId: profile.id,
        provider_interest_submitted_at: submittedAt,
        handoffBefore: submitHandoffBefore,
        handoffAfter: hasProviderInterestHandoff(uid),
        target: "/csp/dashboard/onboarding",
      });
    }

    await refreshFlowProfile();
    emitProviderInterestSubmitted(profile.id, {
      cleaning_experience_bucket: bucket,
      has_own_equipment: hasEquipment,
      has_reliable_transportation: hasTransport,
      provider_review_band: computeProviderReviewBand({
        cleaning_experience_bucket: bucket,
        has_own_equipment: hasEquipment,
        has_reliable_transportation: hasTransport,
      }),
      scope: "residential",
    });
    setSaving(false);
    traceCspFlow("candidate-readiness", {
      branch: "candidate.submit.navigate-onboarding",
      reason: "submit_success",
      pathname: CANDIDATE_PATH,
      uid,
      profileId: profile.id,
      provider_interest_submitted_at: submittedAt,
      handoffBefore: submitHandoffBefore,
      handoffAfter: uid ? hasProviderInterestHandoff(uid) : false,
      target: "/csp/dashboard/onboarding",
    });
    navigate("/csp/dashboard/onboarding", { replace: true });
  }

  traceCspFlow("candidate-readiness", {
    branch: "candidate.render.form",
    reason: "eligible",
    pathname: CANDIDATE_PATH,
    uid,
    profileId: profile.id,
    provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null,
    handoffBefore: hasProviderInterestHandoff(uid),
    handoffAfter: hasProviderInterestHandoff(uid),
    computedInterestSubmitted: false,
    interestSubmitted: false,
    is_onboarded: profile.is_onboarded,
    waiver_accepted_at: profile.waiver_accepted_at,
    identity_status: profile.identity_status,
    readiness_status: profile.readiness_status,
    application_status: profile.application_status,
    application_submitted_at: profile.application_submitted_at,
    application_approved_at: profile.application_approved_at ?? null,
    marketplace_access: profile.marketplace_access,
    target: null,
  });
  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Residential provider interest</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Cleanr is building a residential cleaning provider pipeline in Metro Atlanta. Your answers help us prioritize
          who we review first. This is not a job application outcome — we may reach out on a rolling basis.
        </p>
      </header>

      <section
        className="rounded-2xl border p-4 mb-6 text-sm space-y-2"
        style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)", color: CSP_TEXT_SECONDARY }}
      >
        <p className="font-medium" style={{ color: CSP_TEXT_PRIMARY }}>
          Please read
        </p>
        <ul className="list-disc list-inside space-y-1">
          <li>Opportunities we are preparing for are residential cleaning only.</li>
          <li>Submitting this form does not guarantee immediate activation on Cleanr.</li>
          <li>It does not guarantee immediate background screening or a background check order.</li>
          <li>It does not guarantee job placement or earnings.</li>
          <li>Stronger readiness may mean earlier review, but we still review other candidates over time.</li>
        </ul>
      </section>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <div>
          <p className="text-sm font-medium mb-2" style={{ color: CSP_TEXT_SECONDARY }}>
            How long have you been cleaning professionally?
          </p>
          <div className="space-y-2">
            {CLEANING_EXPERIENCE_BUCKETS.map((b) => (
              <label key={b} className="flex items-center gap-3 cursor-pointer" style={{ color: CSP_TEXT_PRIMARY }}>
                <input
                  type="radio"
                  name="experience"
                  value={b}
                  checked={bucket === b}
                  onChange={() => setBucket(b)}
                />
                <span>{EXPERIENCE_LABELS[b]}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2" style={{ color: CSP_TEXT_SECONDARY }}>
            Do you have your own cleaning equipment and supplies?
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="equipment"
                checked={hasEquipment === true}
                onChange={() => setHasEquipment(true)}
              />
              <span>Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="equipment"
                checked={hasEquipment === false}
                onChange={() => setHasEquipment(false)}
              />
              <span>No</span>
            </label>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2" style={{ color: CSP_TEXT_SECONDARY }}>
            Do you have reliable transportation to get to jobs?
          </p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="transport"
                checked={hasTransport === true}
                onChange={() => setHasTransport(true)}
              />
              <span>Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="transport"
                checked={hasTransport === false}
                onChange={() => setHasTransport(false)}
              />
              <span>No</span>
            </label>
          </div>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
        >
          {saving ? "Saving…" : "Join the candidate pool"}
        </button>
      </form>
    </div>
  );
}
