import { Navigate, useNavigate } from "react-router-dom";
import { useCspFlowProfile } from "@/hooks/useCspFlowProfile";
import { mergeFlowProfileWithHandoffs } from "@/lib/cspFlowHandoff";
import { traceCspFlow } from "@/lib/cspFlowTrace";
import { CSP_SECTION_GAP, CSP_SURFACE, CSP_TEXT_PRIMARY, CSP_TEXT_SECONDARY } from "@/theme/cspTheme";
import { CspNeutralLoading } from "../components/CspNeutralLoading";

const APPLICATION_STATUS_PATH = "/csp/dashboard/application-status";
const VERIFICATION_PATH = "/csp/dashboard/verification";
const DASHBOARD_PATH = "/csp/dashboard";
const CSP_PRIMARY_BUTTON =
  "inline-flex items-center justify-center rounded-xl bg-[#0A84FF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#006EDC] focus:outline-none focus:ring-2 focus:ring-[#0A84FF] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export default function ApplicationStatusScreen() {
  const navigate = useNavigate();
  const { uid, loading, profileFlow } = useCspFlowProfile();

  if (loading) {
    return <CspNeutralLoading />;
  }
  if (!uid) return <Navigate to="/csp/login" replace />;
  if (!profileFlow || profileFlow.role !== "csp") return <Navigate to={DASHBOARD_PATH} replace />;

  const profile = mergeFlowProfileWithHandoffs(profileFlow, uid);
  const appStatusNorm = (profile.application_status ?? "").toLowerCase();
  const approvedLike = appStatusNorm === "approved" || appStatusNorm === "waitlisted";
  const needsReviewLike = appStatusNorm === "rejected" || appStatusNorm === "needs_review";
  const notStartedLike = appStatusNorm === "" || appStatusNorm === "not_started" || appStatusNorm === "draft";

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

  if (notStartedLike) {
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

  if (needsReviewLike) {
    traceCspFlow("application-status", {
      branch: "application.render.needs-review",
      reason: "needs_attention",
      pathname: APPLICATION_STATUS_PATH,
      uid,
      profileId: profile.id,
      application_status: profile.application_status ?? null,
      provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null,
      is_onboarded: profile.is_onboarded,
      identity_status: profile.identity_status ?? null,
      readiness_status: profile.readiness_status ?? null,
      marketplace_access: profile.marketplace_access,
      target: null,
    });

    return (
      <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
        <header style={{ marginBottom: CSP_SECTION_GAP }}>
          <h1 className="text-2xl font-semibold">Application needs attention</h1>
          <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
            We need more information before marketplace access can be reviewed.
          </p>
        </header>
        <button
          type="button"
          onClick={() => navigate(VERIFICATION_PATH)}
          className={`w-full ${CSP_PRIMARY_BUTTON}`}
        >
          Update verification
        </button>
      </div>
    );
  }

  traceCspFlow("application-status", {
    branch: "application.render.under-review",
    reason: "under_review",
    pathname: APPLICATION_STATUS_PATH,
    uid,
    profileId: profile.id,
    provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null,
    interestSubmitted: Boolean(profile.provider_interest_submitted_at),
    is_onboarded: profile.is_onboarded,
    waiver_accepted_at: profile.waiver_accepted_at ?? null,
    identity_status: profile.identity_status ?? null,
    readiness_status: profile.readiness_status ?? null,
    application_status: profile.application_status ?? null,
    application_submitted_at: profile.application_submitted_at ?? null,
    application_approved_at: profile.application_approved_at ?? null,
    marketplace_access: profile.marketplace_access,
    target: null,
  });

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Application under review</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          We&apos;re reviewing your provider setup, identity, availability, and service area. We&apos;ll update your
          status when review is complete.
        </p>
      </header>

      <section
        className="rounded-2xl border p-4 mb-6 space-y-3"
        style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: CSP_TEXT_PRIMARY }}>
            Onboarding / waiver
          </span>
          <span className="rounded-full border px-2 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-300 border-emerald-400/30">
            Complete
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: CSP_TEXT_PRIMARY }}>
            Identity verification
          </span>
          <span className="rounded-full border px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-200 border-amber-400/30">
            Submitted
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: CSP_TEXT_PRIMARY }}>
            Readiness review
          </span>
          <span className="rounded-full border px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-200 border-amber-400/30">
            Submitted
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: CSP_TEXT_PRIMARY }}>
            Application
          </span>
          <span className="rounded-full border px-2 py-0.5 text-xs font-medium bg-amber-500/15 text-amber-200 border-amber-400/30">
            Under review
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: CSP_TEXT_PRIMARY }}>
            Marketplace access
          </span>
          <span className="rounded-full border px-2 py-0.5 text-xs font-medium bg-white/10 text-slate-300 border-white/10">
            Pending approval
          </span>
        </div>
      </section>

      <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        No action is needed right now. We&apos;ll update this page when review is complete.
      </p>
    </div>
  );
}
