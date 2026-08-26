import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../../lib/useProfile";
import {
  CSP_CARD_PADDING,
  CSP_SECTION_GAP,
  CSP_SURFACE,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

type DisplayStatus = "Not started" | "Submitted" | "Verified" | "In progress";

function toDisplayStatus(raw: string | null | undefined): DisplayStatus {
  if (!raw) return "Not started";
  const normalized = raw.toLowerCase();
  if (["verified", "approved", "completed", "accepted"].includes(normalized)) {
    return "Verified";
  }
  if (["submitted", "under_review", "pending", "scheduled", "in_progress"].includes(normalized)) {
    return "Submitted";
  }
  return "Not started";
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
  const checklist = useMemo(
    () => [
      ...(isApproved
        ? [
            {
              label: "Payout Setup",
              status: payoutDisplayStatus(profile),
              step: "payout-setup",
            },
          ]
        : []),
      {
        label: "Transportation",
        status: toDisplayStatus(profile?.travel_readiness_status),
        step: "transportation",
      },
      {
        label: "Insurance (optional)",
        status: toDisplayStatus(profile?.insurance_status),
        step: "insurance",
      },
      {
        label: "ID Verification",
        status: toDisplayStatus(profile?.identity_status),
        step: "identity",
      },
      {
        label: "Background Check",
        status: toDisplayStatus(profile?.background_check_status),
        step: "background",
      },
      {
        label: "Screening",
        status: toDisplayStatus(profile?.screening_status),
        step: "screening",
      },
    ],
    [
      profile?.application_status,
      isApproved,
      profile?.stripe_connect_ready,
      profile?.stripe_connect_account_id,
      profile?.travel_readiness_status,
      profile?.insurance_status,
      profile?.identity_status,
      profile?.background_check_status,
      profile?.screening_status,
    ]
  );

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Application Checklist</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Complete or review the remaining steps in your provider application.
        </p>
      </header>

      <section className="space-y-3" style={{ marginBottom: CSP_SECTION_GAP }}>
        {checklist.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(`/csp/dashboard/application/${item.step}`)}
            className="w-full rounded-2xl border text-left transition-colors"
            style={{
              backgroundColor: CSP_SURFACE,
              padding: CSP_CARD_PADDING,
              borderColor: "rgba(248, 250, 252, 0.08)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{item.label}</p>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${chipClasses(item.status)}`}>
                {item.status}
              </span>
            </div>
          </button>
        ))}
      </section>
    </div>
  );
}
