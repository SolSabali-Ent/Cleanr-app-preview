import { Navigate, useNavigate } from "react-router-dom";
import { useCspFlowProfile } from "@/hooks/useCspFlowProfile";
import { mergeFlowProfileWithHandoffs } from "@/lib/cspFlowHandoff";
import { traceCspFlow } from "@/lib/cspFlowTrace";
import { CSP_SECTION_GAP, CSP_SURFACE, CSP_TEXT_PRIMARY, CSP_TEXT_SECONDARY } from "@/theme/cspTheme";
import { CspNeutralLoading } from "../components/CspNeutralLoading";

const APPLICATION_STATUS_PATH = "/csp/dashboard/application-status";
const APPLICATION_PATH = "/csp/dashboard/application";
const VERIFICATION_PATH = "/csp/dashboard/verification";
const DASHBOARD_PATH = "/csp/dashboard";
const CSP_PRIMARY_BUTTON =
  "inline-flex items-center justify-center rounded-xl bg-[#0A84FF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#006EDC] focus:outline-none focus:ring-2 focus:ring-[#0A84FF] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

type DisplayState = "Complete" | "Submitted" | "Needs action" | "Not started" | "Under review" | "Pending approval";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function statusToDisplay(value: string | null | undefined): DisplayState {
  const status = normalize(value);
  if (["verified", "approved", "completed", "clear", "accepted", "waived"].includes(status)) return "Complete";
  if (["rejected", "failed", "declined", "needs_review", "needs_action"].includes(status)) return "Needs action";
  if (["submitted", "pending", "scheduled", "in_progress", "under_review"].includes(status)) return "Submitted";
  return "Not started";
}

function applicationToDisplay(value: string | null | undefined): DisplayState {
  const status = normalize(value);
  if (status === "approved" || status === "waitlisted") return "Complete";
  if (status === "rejected" || status === "needs_review") return "Needs action";
  if (status === "under_review") return "Under review";
  if (status === "submitted") return "Submitted";
  return "Not started";
}

function chipClasses(status: DisplayState): string {
  if (status === "Complete") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (status === "Needs action") return "bg-rose-500/15 text-rose-200 border-rose-400/30";
  if (status === "Submitted" || status === "Under review") return "bg-amber-500/15 text-amber-200 border-amber-400/30";
  return "bg-white/10 text-slate-300 border-white/10";
}

function StatusRow({ label, status }: { label: string; status: DisplayState }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm" style={{ color: CSP_TEXT_PRIMARY }}>
        {label}
      </span>
      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${chipClasses(status)}`}>
        {status}
      </span>
    </div>
  );
}

export default function ApplicationStatusScreen() {
  const navigate = useNavigate();
  const { uid, loading, profileFlow } = useCspFlowProfile();

  if (loading) return <CspNeutralLoading />;
  if (!uid) return <Navigate to="/csp/login" replace />;
  if (!profileFlow || profileFlow.role !== "csp") return <Navigate to={DASHBOARD_PATH} replace />;

  const profile = mergeFlowProfileWithHandoffs(profileFlow, uid);
  const appStatusNorm = normalize(profile.application_status);
  const approvedLike = appStatusNorm === "approved" || appStatusNorm === "waitlisted";
  const rejectedLike = appStatusNorm === "rejected" || appStatusNorm === "needs_review";
  const notStartedLike = appStatusNorm === "" || appStatusNorm === "not_started" || appStatusNorm === "draft";

  const termsStatus: DisplayState = profile.csp_terms_accepted_at ? "Complete" : "Not started";
  const identityStatus = statusToDisplay(profile.identity_status);
  const backgroundStatus = statusToDisplay(profile.background_check_status);
  const screeningStatus = statusToDisplay(profile.screening_status);
  const transportationStatus = statusToDisplay(profile.travel_readiness_status);
  const applicationStatus = applicationToDisplay(profile.application_status);
  const missingPersonOwnedSteps = [termsStatus, identityStatus, backgroundStatus, screeningStatus, transportationStatus].some(
    (status) => status === "Not started" || status === "Needs action"
  );
  const needsAction = rejectedLike || missingPersonOwnedSteps;

  traceCspFlow("application-status", {
    branch: "application.read.status",
    reason: "profile_loaded",
    pathname: APPLICATION_STATUS_PATH,
    uid,
    profileId: profile.id,
    application_status: profile.application_status ?? null,
    application_submitted_at: profile.application_submitted_at ?? null,
    identity_status: profile.identity_status ?? null,
    readiness_status: profile.readiness_status ?? null,
    background_check_status: profile.background_check_status ?? null,
    screening_status: profile.screening_status ?? null,
    travel_readiness_status: profile.travel_readiness_status ?? null,
    is_onboarded: profile.is_onboarded,
  });

  if (approvedLike) {
    traceCspFlow("application-status", {
      branch: "application.redirect.dashboard",
      reason: "approved_like",
      pathname: APPLICATION_STATUS_PATH,
      uid,
      profileId: profile.id,
      application_status: profile.application_status ?? null,
      marketplace_access: profile.marketplace_access,
      target: DASHBOARD_PATH,
    });
    return <Navigate to={DASHBOARD_PATH} replace />;
  }

  if (notStartedLike && !missingPersonOwnedSteps) {
    traceCspFlow("application-status", {
      branch: "application.redirect.verification",
      reason: "not_started",
      pathname: APPLICATION_STATUS_PATH,
      uid,
      profileId: profile.id,
      application_status: profile.application_status ?? null,
      target: VERIFICATION_PATH,
    });
    return <Navigate to={VERIFICATION_PATH} replace />;
  }

  traceCspFlow("application-status", {
    branch: needsAction ? "application.render.needs-action" : "application.render.under-review",
    reason: needsAction ? "person_owned_step_or_review_attention" : "under_review",
    pathname: APPLICATION_STATUS_PATH,
    uid,
    profileId: profile.id,
    provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null,
    is_onboarded: profile.is_onboarded,
    identity_status: profile.identity_status ?? null,
    readiness_status: profile.readiness_status ?? null,
    background_check_status: profile.background_check_status ?? null,
    screening_status: profile.screening_status ?? null,
    travel_readiness_status: profile.travel_readiness_status ?? null,
    application_status: profile.application_status ?? null,
    application_submitted_at: profile.application_submitted_at ?? null,
    application_approved_at: profile.application_approved_at ?? null,
    marketplace_access: profile.marketplace_access,
    target: needsAction ? APPLICATION_PATH : null,
  });

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">{needsAction ? "Application setup needs attention" : "Application under review"}</h1>
        <p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
          {needsAction
            ? "Your application has review activity, but one or more setup steps still need your input. Complete those steps so Cleanr can review the full application."
            : "Your required setup has been submitted. Cleanr is reviewing the application and will update this status when a decision is recorded."}
        </p>
      </header>

      {profile.rejection_reason ? (
        <section
          className="mb-6 rounded-2xl border p-4"
          style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(251, 113, 133, 0.28)" }}
        >
          <p className="text-sm font-semibold text-rose-200">Review note</p>
          <p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
            {profile.rejection_reason}
          </p>
        </section>
      ) : null}

      <section
        className="mb-6 space-y-3 rounded-2xl border p-4"
        style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)" }}
      >
        <StatusRow label="CSP terms" status={termsStatus} />
        <StatusRow label="Identity verification" status={identityStatus} />
        <StatusRow label="Background check" status={backgroundStatus} />
        <StatusRow label="Screening" status={screeningStatus} />
        <StatusRow label="Transportation readiness" status={transportationStatus} />
        <StatusRow label="Application" status={applicationStatus} />
        <StatusRow label="Marketplace access" status="Pending approval" />
      </section>

      {needsAction ? (
        <div className="space-y-3">
          <button type="button" onClick={() => navigate(APPLICATION_PATH)} className={`w-full ${CSP_PRIMARY_BUTTON}`}>
            Open application checklist
          </button>
          <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
            Cleanr review does not replace steps you still own. Submitted items can remain pending while you finish the rest.
          </p>
        </div>
      ) : (
        <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
          No provider-owned setup action is required right now. Verification outcomes and the application decision are completed by Cleanr or its review partners.
        </p>
      )}
    </div>
  );
}
