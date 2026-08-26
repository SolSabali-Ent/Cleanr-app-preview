import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { findAvailableJobsForProvider, listMyJobsAsProvider, type AvailableJob } from "../../../lib/bookingApi";
import type { Booking } from "../../../domain/booking";
import { useStableSessionProfile } from "@/hooks/useStableSessionProfile";
import { profileToProviderFlow, shouldShowMarketplacePendingPanel } from "@/lib/providerFlow";
import {
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SURFACE,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

type DisplayStatus = "Not started" | "Submitted" | "Verified";

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

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

function formatDistance(meters: number | undefined): string {
  if (meters == null) return "Distance unavailable";
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)} mi away`;
}

export default function TodayScreen() {
  const { displayProfile, showInitialBlocking, stableOk, profileLoading } = useStableSessionProfile();
  const navigate = useNavigate();
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [myJobs, setMyJobs] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  const isUnlocked = Boolean(displayProfile && displayProfile.marketplace_access === true);
  const isOnboarded = Boolean(displayProfile && displayProfile.is_onboarded === true);
  const showMarketplacePending = Boolean(
    displayProfile && shouldShowMarketplacePendingPanel(profileToProviderFlow(displayProfile))
  );

  useEffect(() => {
    if (!displayProfile) {
      setAvailableJobs([]);
      setMyJobs([]);
      setLoading(false);
      return;
    }
    const providerId = displayProfile.role === "csp" ? displayProfile.id : null;
    if (!providerId || !isUnlocked) {
      setAvailableJobs([]);
      setMyJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([findAvailableJobsForProvider(providerId, 20), listMyJobsAsProvider()])
      .then(([available, mine]) => {
        setAvailableJobs(available);
        setMyJobs(mine);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to load dashboard");
      })
      .finally(() => setLoading(false));
  }, [displayProfile?.id, displayProfile?.role, isUnlocked]);

  const checklist = useMemo(
    () => {
      if (!displayProfile) return [];
      return [
        { label: "Agreement", status: displayProfile.agreement_accepted_at ? "Verified" : "Not started" },
        { label: "Insurance (optional)", status: toDisplayStatus(displayProfile.insurance_status) },
        { label: "ID Verification", status: toDisplayStatus(displayProfile.identity_status) },
        { label: "Background Check", status: toDisplayStatus(displayProfile.background_check_status) },
        { label: "Screening", status: toDisplayStatus(displayProfile.screening_status) },
      ];
    },
    [displayProfile]
  );

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (showInitialBlocking) {
      console.info("[today-screen] render initial loading");
    }
  }, [showInitialBlocking]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (stableOk && profileLoading) {
      console.info("[today-screen] render from stable profile");
    }
  }, [stableOk, profileLoading]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (showInitialBlocking || !displayProfile) return;
    console.info("[today-screen] mounted");
    if (isUnlocked) console.info("[today-screen] render live");
    else console.info("[today-screen] render locked");
  }, [showInitialBlocking, displayProfile?.id, isUnlocked, isOnboarded]);

  const marketplaceReviewRows = [
    { label: "Application approved", badge: "Approved" },
    { label: "Profile complete", badge: "Complete" },
    { label: "Marketplace access pending", badge: "Pending" },
    { label: "Jobs not available yet", badge: "Waiting" },
  ] as const;

  if (showInitialBlocking) {
    // Entry splash + resolver live in CspDashboardResolvedShell — avoid a second full-screen loader here.
    return null;
  }

  if (!displayProfile) {
    return null;
  }

  return (
    <div className="relative min-h-[60vh]" style={{ color: CSP_TEXT_PRIMARY }}>
      {!isUnlocked ? (
        showMarketplacePending ? (
          <>
            <header style={{ marginBottom: CSP_SECTION_GAP }}>
              <h1 className="text-2xl font-semibold">Marketplace access pending</h1>
              <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
                Your provider application has been approved. We&apos;re preparing marketplace access in your service
                area and will notify you when jobs are available.
              </p>
            </header>

            <section className="space-y-3" style={{ marginBottom: CSP_SECTION_GAP }}>
              {marketplaceReviewRows.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border"
                  style={{
                    backgroundColor: CSP_SURFACE,
                    borderColor: "rgba(248, 250, 252, 0.08)",
                    padding: CSP_CARD_PADDING,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.label}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium">
                      {item.badge}
                    </span>
                  </div>
                </div>
              ))}
            </section>

            <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
              No action is needed right now.
            </p>
          </>
        ) : (
          <>
            <header style={{ marginBottom: CSP_SECTION_GAP }}>
              <h1 className="text-2xl font-semibold">You're almost ready to start earning.</h1>
              <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
                Complete verification to unlock jobs and payouts.
              </p>
            </header>

            <section className="space-y-3" style={{ marginBottom: CSP_SECTION_GAP }}>
              {checklist.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border"
                  style={{
                    backgroundColor: CSP_SURFACE,
                    borderColor: "rgba(248, 250, 252, 0.08)",
                    padding: CSP_CARD_PADDING,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.label}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium">
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </section>

            <button
              type="button"
              onClick={() => navigate("/csp/dashboard/application")}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
            >
              Finish verification
            </button>
            <p className="mt-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
              Approval protects customers and protects you.
            </p>
          </>
        )
      ) : (
        <>
          <header style={{ marginBottom: CSP_SECTION_GAP }}>
            <h1 className="text-2xl font-semibold">You're live in the marketplace.</h1>
            <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
              Pick jobs fast, stay consistent, and keep your rating high.
            </p>
          </header>

          <section style={{ marginBottom: CSP_SECTION_GAP }}>
            <div
              className="rounded-2xl border"
              style={{
                backgroundColor: CSP_SURFACE,
                borderColor: "rgba(248, 250, 252, 0.08)",
                padding: CSP_CARD_PADDING,
              }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Availability</p>
                <button
                  type="button"
                  onClick={() => setIsOnline((prev) => !prev)}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold"
                  style={{
                    backgroundColor: isOnline ? "rgba(16, 185, 129, 0.2)" : "rgba(148, 163, 184, 0.2)",
                    color: isOnline ? "#6EE7B7" : "#CBD5E1",
                  }}
                >
                  {isOnline ? "Go offline" : "Go online"}
                </button>
              </div>
              <p className="mt-2 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                Route optimization is coming soon.
              </p>
            </div>
          </section>

          <section style={{ marginBottom: CSP_SECTION_GAP }}>
            <h2 className="text-sm font-medium mb-3" style={{ color: CSP_TEXT_SECONDARY }}>
              Available Jobs
            </h2>
            {loading ? (
              <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                Loading available jobs...
              </p>
            ) : error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : availableJobs.length === 0 ? (
              <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                No jobs near your service radius right now.
              </p>
            ) : (
              <div className="space-y-3">
                {availableJobs.slice(0, 3).map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => navigate(`/csp/dashboard/jobs/${job.id}`)}
                    className="w-full rounded-2xl border text-left"
                    style={{
                      backgroundColor: CSP_SURFACE,
                      borderColor: "rgba(248, 250, 252, 0.08)",
                      padding: CSP_CARD_PADDING,
                    }}
                  >
                    <p className="font-medium">{formatDistance(job.distance_meters)}</p>
                    <p className="text-sm mt-1" style={{ color: CSP_TEXT_SECONDARY }}>
                      {formatDateTime(job.scheduled_start)}
                    </p>
                    <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                      ${(job.price_cents / 100).toFixed(0)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section style={{ marginBottom: CSP_SECTION_GAP }}>
            <h2 className="text-sm font-medium mb-3" style={{ color: CSP_TEXT_SECONDARY }}>
              My Jobs
            </h2>
            <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
              {myJobs.length} assigned jobs in your queue.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-medium mb-3" style={{ color: CSP_TEXT_SECONDARY }}>
              Today
            </h2>
            <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
              Keep momentum. Fast responses unlock more volume.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
