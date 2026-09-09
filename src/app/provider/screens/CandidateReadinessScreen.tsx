import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";
import { useCspFlowProfile } from "@/hooks/useCspFlowProfile";
import {
  CLEANING_EXPERIENCE_BUCKETS,
  type CleaningExperienceBucket,
} from "../../../lib/providerReadiness";
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

type ExistingClientHouseholdBucket = "none" | "1_2" | "3_5" | "6_plus" | "prefer_not_to_say";

const EXISTING_CLIENT_LABELS: Record<ExistingClientHouseholdBucket, string> = {
  none: "No — not right now",
  "1_2": "Yes — 1–2 households",
  "3_5": "Yes — 3–5 households",
  "6_plus": "Yes — 6+ households",
  prefer_not_to_say: "Prefer not to say",
};

type ReadinessSubmissionResult = {
  provider_id?: string;
  scope?: string;
  provider_review_band?: string;
  submitted_at?: string;
};

export default function CandidateReadinessScreen() {
  const navigate = useNavigate();
  const { uid, loading: flowLoading, profileFlow, refreshFlowProfile } = useCspFlowProfile();
  const [bucket, setBucket] = useState<CleaningExperienceBucket | "">("");
  const [hasEquipment, setHasEquipment] = useState<boolean | null>(null);
  const [hasTransport, setHasTransport] = useState<boolean | null>(null);
  const [existingClients, setExistingClients] = useState<ExistingClientHouseholdBucket | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (flowLoading || !uid) {
    traceCspFlow("candidate-readiness", { branch: "candidate.loading", reason: flowLoading ? "flow_profile_loading" : "missing_uid", pathname: CANDIDATE_PATH, uid: uid ?? null });
    return <CspNeutralLoading />;
  }

  if (!profileFlow || profileFlow.id !== uid) {
    traceCspFlow("candidate-readiness", { branch: "candidate.loading", reason: "profile_missing", pathname: CANDIDATE_PATH, uid });
    return (
      <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
        <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>We couldn&apos;t load your provider profile. You&apos;re still signed in.</p>
        <button type="button" className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }} onClick={() => void refreshFlowProfile()}>Try again</button>
        <button type="button" className="mt-3 w-full rounded-xl border py-3 text-sm font-medium" style={{ borderColor: "rgba(248, 250, 252, 0.12)", color: CSP_TEXT_SECONDARY }} onClick={() => navigate("/csp/login", { replace: true })}>Back to sign in</button>
      </div>
    );
  }

  const profile = profileFlow;
  if (profile.role !== "csp") return <Navigate to="/csp/login" replace />;

  const handoffBefore = hasProviderInterestHandoff(uid);
  const flowForDecision = mergeFlowProfileWithHandoffs(profile, uid);
  const forwardTarget = getCspFlowRedirectTarget(CANDIDATE_PATH, flowForDecision);

  if (forwardTarget && forwardTarget !== CANDIDATE_PATH) {
    const dbInterest = hasProviderInterestSubmitted(profile);
    if (forwardTarget === "/csp/dashboard/onboarding" && dbInterest) setProviderInterestHandoff(profile.id);
    traceCspFlow("candidate-readiness", {
      branch: forwardTarget === "/csp/dashboard/onboarding" ? "candidate.redirect.onboarding" : "candidate.redirect.forward",
      reason: "flow_target",
      pathname: CANDIDATE_PATH,
      uid: profile.id,
      profileId: profile.id,
      provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null,
      handoffBefore,
      handoffAfter: hasProviderInterestHandoff(profile.id),
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
    if (!bucket) return setError("Select how long you have been cleaning professionally.");
    if (hasEquipment === null) return setError("Tell us whether you have your own equipment and supplies.");
    if (hasTransport === null) return setError("Tell us whether you have reliable transportation.");
    if (!existingClients) return setError("Tell us whether you already serve homes, or choose Prefer not to say.");

    const providerId = profile.id;
    setSaving(true);
    const rpcPayload = { p_experience_bucket: bucket, p_has_own_equipment: hasEquipment, p_has_reliable_transportation: hasTransport, p_scope: "residential" };
    const traceRpc = await traceProfileWriteStart({
      source: "CandidateReadinessScreen.submitInterest:submit_provider_readiness",
      operation: "rpc",
      targetId: providerId,
      payload: rpcPayload,
      pathname: CANDIDATE_PATH,
      cspFlowState: { provider_interest_submitted_at: profile.provider_interest_submitted_at, is_onboarded: profile.is_onboarded, application_status: profile.application_status },
    });
    const submitResult = await supabase.rpc("submit_provider_readiness", rpcPayload);
    traceProfileWriteResult(traceRpc, submitResult);
    if (submitResult.error) { setError(submitResult.error.message); setSaving(false); return; }

    const signalResult = await supabase.rpc("set_my_existing_client_readiness_signal", { p_existing_client_household_bucket: existingClients });
    if (signalResult.error) { setError("We saved your answers, but we could not save the part about current clients. Please try again."); setSaving(false); return; }

    const result = (submitResult.data ?? {}) as ReadinessSubmissionResult;
    const submittedAt = result.submitted_at ?? new Date().toISOString();
    traceCspFlow("candidate-readiness", { branch: "candidate.write.interest", reason: "readiness_rpc_success", pathname: CANDIDATE_PATH, uid: providerId, profileId: providerId, provider_interest_submitted_at: submittedAt, provider_review_band: result.provider_review_band ?? null, existing_client_household_bucket: existingClients });

    const submitHandoffBefore = hasProviderInterestHandoff(providerId);
    setProviderInterestHandoff(providerId);
    await refreshFlowProfile();
    setSaving(false);
    traceCspFlow("candidate-readiness", { branch: "candidate.submit.navigate-onboarding", reason: "submit_success", pathname: CANDIDATE_PATH, uid: providerId, profileId: providerId, provider_interest_submitted_at: submittedAt, handoffBefore: submitHandoffBefore, handoffAfter: hasProviderInterestHandoff(providerId), target: "/csp/dashboard/onboarding" });
    navigate("/csp/dashboard/onboarding", { replace: true });
  }

  traceCspFlow("candidate-readiness", { branch: "candidate.render.form", reason: "eligible", pathname: CANDIDATE_PATH, uid, profileId: profile.id, provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null, handoffBefore: hasProviderInterestHandoff(uid), handoffAfter: hasProviderInterestHandoff(uid), computedInterestSubmitted: false, interestSubmitted: false, is_onboarded: profile.is_onboarded, waiver_accepted_at: profile.waiver_accepted_at, identity_status: profile.identity_status, readiness_status: profile.readiness_status, application_status: profile.application_status, application_submitted_at: profile.application_submitted_at, application_approved_at: profile.application_approved_at ?? null, marketplace_access: profile.marketplace_access, target: null });

  const choiceClass = (active: boolean) => `flex min-h-12 w-full cursor-pointer items-center gap-3 px-4 py-3 text-sm ${active ? "bg-white/10" : "bg-transparent"}`;

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: CSP_TEXT_SECONDARY }}>Get started</p>
        <h1 className="mt-2 text-2xl font-semibold">Tell us about your work</h1>
        <p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>A few quick questions help us learn how you work today and what you may need next.</p>
      </header>

      <details className="mb-6 border-y border-white/10 py-3">
        <summary className="cursor-pointer text-xs font-semibold" style={{ color: CSP_TEXT_SECONDARY }}>Before you submit</summary>
        <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
          This is for home-cleaning work in Metro Atlanta. Applying does not promise jobs or earnings. Having existing clients does not give you special approval.
        </p>
      </details>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-7">
        <section>
          <p className="mb-2 text-sm font-medium">How long have you been cleaning professionally?</p>
          <div className="overflow-hidden rounded-2xl border border-white/10" style={{ backgroundColor: CSP_SURFACE }}>
            {CLEANING_EXPERIENCE_BUCKETS.map((b, index) => (
              <label key={b} className={`${choiceClass(bucket === b)} ${index > 0 ? "border-t border-white/10" : ""}`}>
                <input type="radio" name="experience" value={b} checked={bucket === b} onChange={() => setBucket(b)} className="accent-[#0A84FF]" />
                <span>{EXPERIENCE_LABELS[b]}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-sm font-medium">Do you have your own equipment and supplies?</p>
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10" style={{ backgroundColor: CSP_SURFACE }}>
            {[true, false].map((value, index) => <label key={String(value)} className={`${choiceClass(hasEquipment === value)} ${index > 0 ? "border-l border-white/10" : ""}`}><input type="radio" name="equipment" checked={hasEquipment === value} onChange={() => setHasEquipment(value)} className="accent-[#0A84FF]" /><span>{value ? "Yes" : "No"}</span></label>)}
          </div>
        </section>

        <section>
          <p className="mb-2 text-sm font-medium">Do you have reliable transportation?</p>
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/10" style={{ backgroundColor: CSP_SURFACE }}>
            {[true, false].map((value, index) => <label key={String(value)} className={`${choiceClass(hasTransport === value)} ${index > 0 ? "border-l border-white/10" : ""}`}><input type="radio" name="transport" checked={hasTransport === value} onChange={() => setHasTransport(value)} className="accent-[#0A84FF]" /><span>{value ? "Yes" : "No"}</span></label>)}
          </div>
        </section>

        <section>
          <p className="text-sm font-medium">Do you already clean homes outside Cleanr?</p>
          <p className="mb-2 mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>This helps us understand the work you already built.</p>
          <div className="overflow-hidden rounded-2xl border border-white/10" style={{ backgroundColor: CSP_SURFACE }}>
            {(Object.keys(EXISTING_CLIENT_LABELS) as ExistingClientHouseholdBucket[]).map((value, index) => (
              <label key={value} className={`${choiceClass(existingClients === value)} ${index > 0 ? "border-t border-white/10" : ""}`}>
                <input type="radio" name="existing-clients" value={value} checked={existingClients === value} onChange={() => setExistingClients(value)} className="accent-[#0A84FF]" />
                <span>{EXISTING_CLIENT_LABELS[value]}</span>
              </label>
            ))}
          </div>
        </section>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

        <button type="submit" disabled={saving} className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
          {saving ? "Saving…" : "Continue setup"}
        </button>
      </form>
    </div>
  );
}
