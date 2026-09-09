import { ChevronRight } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useCspFlowProfile } from "@/hooks/useCspFlowProfile";
import { mergeFlowProfileWithHandoffs } from "@/lib/cspFlowHandoff";
import { traceCspFlow } from "@/lib/cspFlowTrace";
import { CSP_PRIMARY_BUTTON, CSP_SECTION_GAP, CSP_SURFACE, CSP_TEXT_PRIMARY, CSP_TEXT_SECONDARY } from "@/theme/cspTheme";
import { CspNeutralLoading } from "../components/CspNeutralLoading";

const APPLICATION_STATUS_PATH = "/csp/dashboard/application-status";
const APPLICATION_PATH = "/csp/dashboard/application";
const VERIFICATION_PATH = "/csp/dashboard/verification";
const DASHBOARD_PATH = "/csp/dashboard";

type DisplayState = "Complete" | "Submitted" | "Needs action" | "Not started" | "Under review" | "Pending approval";

type StatusItem = { label: string; status: DisplayState; path?: string };

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

function identityToDisplay(status: string | null | undefined, documentPath: string | null | undefined): DisplayState {
  if (!documentPath?.trim()) return "Not started";
  return statusToDisplay(status);
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

  const items: StatusItem[] = [
    { label: "CSP terms", status: profile.csp_terms_accepted_at ? "Complete" : "Not started", path: "/csp/dashboard/terms" },
    { label: "Identity verification", status: identityToDisplay(profile.identity_status, profile.identity_document_path), path: "/csp/dashboard/application/identity" },
    { label: "Background check", status: statusToDisplay(profile.background_check_status), path: "/csp/dashboard/application/background" },
    { label: "Screening", status: statusToDisplay(profile.screening_status), path: "/csp/dashboard/application/screening" },
    { label: "Transportation", status: statusToDisplay(profile.travel_readiness_status), path: "/csp/dashboard/application/transportation" },
    { label: "Application", status: applicationToDisplay(profile.application_status) },
    { label: "Marketplace access", status: "Pending approval" },
  ];

  const personOwnedItems = items.slice(0, 5);
  const nextActionItem = personOwnedItems.find((item) => item.status === "Needs action")
    ?? personOwnedItems.find((item) => item.status === "Not started")
    ?? null;
  const missingPersonOwnedSteps = Boolean(nextActionItem);
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

  if (approvedLike) return <Navigate to={DASHBOARD_PATH} replace />;
  if (notStartedLike && !missingPersonOwnedSteps) return <Navigate to={VERIFICATION_PATH} replace />;

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
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: CSP_TEXT_SECONDARY }}>Application status</p>
        <h1 className="mt-2 text-2xl font-semibold">{needsAction ? "One more thing needs attention" : "Your application is under review"}</h1>
        <p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
          {needsAction
            ? nextActionItem ? `${nextActionItem.label} still needs your input.` : "Cleanr left a review note that needs your attention."
            : "Everything you own is submitted. There is nothing you need to do right now."}
        </p>
      </header>

      {profile.rejection_reason ? (
        <section className="mb-6 border-y border-rose-400/20 py-4">
          <p className="text-sm font-semibold text-rose-200">Review note</p>
          <p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>{profile.rejection_reason}</p>
        </section>
      ) : null}

      {needsAction ? (
        <section className="mb-6 border-b border-white/10 pb-6">
          {nextActionItem ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_TEXT_SECONDARY }}>Next step</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-lg font-semibold">{nextActionItem.label}</p>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${chipClasses(nextActionItem.status)}`}>{nextActionItem.status}</span>
              </div>
              <button type="button" onClick={() => navigate(nextActionItem.path ?? APPLICATION_PATH)} className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Continue application</button>
            </>
          ) : (
            <button type="button" onClick={() => navigate(APPLICATION_PATH)} className="w-full rounded-xl py-3 text-sm font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Open application</button>
          )}
        </section>
      ) : null}

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_TEXT_SECONDARY }}>Progress</p>
        <div className="overflow-hidden rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)" }}>
          {items.map((item, index) => (
            <button
              key={item.label}
              type="button"
              disabled={!item.path}
              onClick={() => item.path && navigate(item.path)}
              className={`flex w-full items-center gap-3 px-4 py-4 text-left disabled:cursor-default ${index > 0 ? "border-t border-white/10" : ""}`}
            >
              <span className="min-w-0 flex-1 text-sm">{item.label}</span>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${chipClasses(item.status)}`}>{item.status}</span>
              {item.path ? <ChevronRight className="h-4 w-4 shrink-0" style={{ color: CSP_TEXT_SECONDARY }} /> : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
