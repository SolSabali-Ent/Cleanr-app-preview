import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../../lib/useProfile";
import {
  CSP_PRIMARY_BUTTON,
  CSP_SECTION_GAP,
  CSP_SURFACE,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

type DisplayStatus = "Not started" | "Submitted" | "Verified" | "In progress";

type ChecklistItem = {
  label: string;
  status: DisplayStatus;
  path: string;
  note: string | null;
  optional?: boolean;
};

function toDisplayStatus(raw: string | null | undefined): DisplayStatus {
  if (!raw) return "Not started";
  const normalized = raw.toLowerCase();
  if (["verified", "approved", "completed", "accepted", "clear", "waived"].includes(normalized)) return "Verified";
  if (["submitted", "under_review", "pending", "scheduled", "in_progress"].includes(normalized)) return "Submitted";
  return "Not started";
}

function identityDisplayStatus(
  status: string | null | undefined,
  documentPath: string | null | undefined
): DisplayStatus {
  if (!documentPath?.trim()) return "Not started";
  return toDisplayStatus(status);
}

function payoutDisplayStatus(profile: { stripe_connect_ready?: boolean | null; stripe_connect_account_id?: string | null } | null): DisplayStatus {
  if (!profile) return "Not started";
  const hasId = Boolean(profile.stripe_connect_account_id?.trim());
  const ready = profile.stripe_connect_ready === true;
  if (ready && hasId) return "Verified";
  if (hasId && !ready) return "In progress";
  return "Not started";
}

function chipClasses(status: DisplayStatus): string {
  if (status === "Verified") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  if (status === "Submitted" || status === "In progress") return "bg-amber-500/15 text-amber-200 border-amber-400/30";
  return "bg-white/10 text-slate-300 border-white/10";
}

export default function ApplicationHubScreen() {
  const navigate = useNavigate();
  const { profile } = useProfile();

  const isApproved = profile?.application_status === "approved";
  const checklist = useMemo<ChecklistItem[]>(
    () => [
      {
        label: "Profile photo",
        status: profile?.profile_photo_path?.trim() ? "Verified" : "Not started",
        path: "/csp/dashboard/profile",
        note: "Required before marketplace activation",
      },
      {
        label: "CSP terms",
        status: profile?.csp_terms_accepted_at ? "Verified" : "Not started",
        path: "/csp/dashboard/terms",
        note: null,
      },
      ...(isApproved
        ? [
            {
              label: "Payout setup",
              status: payoutDisplayStatus(profile),
              path: "/csp/dashboard/application/payout-setup",
              note: null,
            } as ChecklistItem,
          ]
        : []),
      {
        label: "Transportation",
        status: toDisplayStatus(profile?.travel_readiness_status),
        path: "/csp/dashboard/application/transportation",
        note: null,
      },
      {
        label: "ID verification",
        status: identityDisplayStatus(profile?.identity_status, profile?.identity_document_path),
        path: "/csp/dashboard/application/identity",
        note: null,
      },
      {
        label: "Background check",
        status: toDisplayStatus(profile?.background_check_status),
        path: "/csp/dashboard/application/background",
        note: null,
      },
      {
        label: "Screening",
        status: toDisplayStatus(profile?.screening_status),
        path: "/csp/dashboard/application/screening",
        note: null,
      },
      {
        label: "Insurance",
        status: toDisplayStatus(profile?.insurance_status),
        path: "/csp/dashboard/application/insurance",
        note: "Optional",
        optional: true,
      },
    ],
    [
      profile?.application_status,
      profile?.profile_photo_path,
      profile?.csp_terms_accepted_at,
      isApproved,
      profile?.stripe_connect_ready,
      profile?.stripe_connect_account_id,
      profile?.travel_readiness_status,
      profile?.insurance_status,
      profile?.identity_status,
      profile?.identity_document_path,
      profile?.background_check_status,
      profile?.screening_status,
    ]
  );

  const requiredItems = checklist.filter((item) => !item.optional);
  const completedRequired = requiredItems.filter((item) => item.status === "Verified").length;
  const nextItem = requiredItems.find((item) => item.status === "Not started")
    ?? requiredItems.find((item) => item.status === "In progress")
    ?? requiredItems.find((item) => item.status === "Submitted")
    ?? null;

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: CSP_TEXT_SECONDARY }}>
          Provider activation
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Finish your application</h1>
        <p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
          {completedRequired} of {requiredItems.length} required steps complete.
        </p>
      </header>

      {nextItem ? (
        <section className="mb-6 border-b border-white/10 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_TEXT_SECONDARY }}>Next step</p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">{nextItem.label}</p>
              <p className="mt-1 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                {nextItem.status === "Submitted" ? "Submitted and waiting for review." : nextItem.status === "In progress" ? "Continue where you left off." : "Complete this to keep your application moving."}
              </p>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${chipClasses(nextItem.status)}`}>{nextItem.status}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate(nextItem.path)}
            className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white"
            style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          >
            {nextItem.status === "Submitted" ? "Review step" : "Continue application"}
          </button>
        </section>
      ) : (
        <section className="mb-6 border-b border-white/10 pb-6">
          <p className="text-lg font-semibold">Required setup complete</p>
          <p className="mt-1 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>There is nothing else for you to complete here right now.</p>
        </section>
      )}

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_TEXT_SECONDARY }}>Application steps</p>
        <div className="overflow-hidden rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)" }}>
          {checklist.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.path)}
              className={`flex w-full items-center gap-3 px-4 py-4 text-left ${index > 0 ? "border-t border-white/10" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                {item.note ? <p className="mt-0.5 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{item.note}</p> : null}
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${chipClasses(item.status)}`}>{item.status}</span>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: CSP_TEXT_SECONDARY }} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
