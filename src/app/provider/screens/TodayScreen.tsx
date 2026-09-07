import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, CalendarClock, Compass, Handshake } from "lucide-react";
import { findAvailableJobsForProvider, listMyJobsAsProvider, type AvailableJob } from "../../../lib/bookingApi";
import type { Booking } from "../../../domain/booking";
import { isCurrentProviderWork, isMissedAcceptedVisit } from "../../../lib/bookingServiceDay";
import { useStableSessionProfile } from "@/hooks/useStableSessionProfile";
import { profileToProviderFlow, shouldShowMarketplacePendingPanel } from "@/lib/providerFlow";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
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
  if (["verified", "approved", "completed", "accepted"].includes(normalized)) return "Verified";
  if (["submitted", "under_review", "pending", "scheduled", "in_progress"].includes(normalized)) return "Submitted";
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

function readableJobStatus(status: string | null | undefined): string {
  if (!status) return "Scheduled";
  const normalized = status.toLowerCase();
  if (normalized === "en_route") return "On the way";
  if (normalized === "in_progress") return "In progress";
  if (normalized === "accepted") return "Scheduled";
  return normalized.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function TodayScreen() {
  const { displayProfile, showInitialBlocking, stableOk, profileLoading } = useStableSessionProfile();
  const navigate = useNavigate();
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [myJobs, setMyJobs] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const checklist = useMemo(() => {
    if (!displayProfile) return [];
    return [
      { label: "Agreement", status: displayProfile.agreement_accepted_at ? "Verified" : "Not started" },
      { label: "Insurance (optional)", status: toDisplayStatus(displayProfile.insurance_status) },
      { label: "ID Verification", status: toDisplayStatus(displayProfile.identity_status) },
      { label: "Background Check", status: toDisplayStatus(displayProfile.background_check_status) },
      { label: "Screening", status: toDisplayStatus(displayProfile.screening_status) },
    ];
  }, [displayProfile]);

  const activeJobs = useMemo(
    () => [...myJobs]
      .filter((job) => isCurrentProviderWork(job))
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()),
    [myJobs]
  );
  const missedJobs = useMemo(
    () => [...myJobs]
      .filter((job) => isMissedAcceptedVisit(job))
      .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()),
    [myJobs]
  );
  const nextJob = activeJobs[0] ?? null;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (showInitialBlocking) console.info("[today-screen] render initial loading");
  }, [showInitialBlocking]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (stableOk && profileLoading) console.info("[today-screen] render from stable profile");
  }, [stableOk, profileLoading]);

  useEffect(() => {
    if (!import.meta.env.DEV || showInitialBlocking || !displayProfile) return;
    console.info("[today-screen] mounted");
    if (isUnlocked) console.info("[today-screen] render live");
    else console.info("[today-screen] render locked");
  }, [showInitialBlocking, displayProfile?.id, isUnlocked, isOnboarded]);

  const marketplaceReviewRows = [
    { label: "Application", badge: "Approved" },
    { label: "Provider profile", badge: "Complete" },
    { label: "Marketplace access", badge: "Pending" },
    { label: "Open-market jobs", badge: "Not available yet" },
  ] as const;

  const existingClientAction = (
    <button
      type="button"
      onClick={() => navigate("/csp/dashboard/existing-clients")}
      className="w-full rounded-2xl border text-left transition-opacity hover:opacity-90"
      style={{
        backgroundColor: "rgba(141, 204, 100, 0.08)",
        borderColor: "rgba(141, 204, 100, 0.24)",
        padding: CSP_CARD_PADDING,
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}20` }}>
          <Handshake size={20} style={{ color: CSP_PRIMARY_BUTTON }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Bring a client you already work with</p>
          <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Invite an existing household to use Cleanr with you.</p>
        </div>
        <ArrowRight size={17} className="shrink-0" style={{ color: CSP_PRIMARY_BUTTON }} />
      </div>
    </button>
  );

  if (showInitialBlocking || !displayProfile) return null;

  return (
    <div className="relative min-h-[60vh]" style={{ color: CSP_TEXT_PRIMARY }}>
      {!isUnlocked ? (
        showMarketplacePending ? (
          <>
            <header style={{ marginBottom: CSP_SECTION_GAP }}>
              <h1 className="text-2xl font-semibold">You&apos;re approved. Marketplace access is next.</h1>
              <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
                We&apos;re preparing marketplace access in your service area and will notify you when open-market jobs are available.
              </p>
            </header>
            <section className="space-y-3" style={{ marginBottom: CSP_SECTION_GAP }}>
              {marketplaceReviewRows.map((item) => (
                <div key={item.label} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)", padding: CSP_CARD_PADDING }}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.label}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium">{item.badge}</span>
                  </div>
                </div>
              ))}
            </section>
            <section style={{ marginBottom: CSP_SECTION_GAP }}>
              <p className="mb-3 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                You do not need open-market access to preserve a relationship you already created.
              </p>
              {existingClientAction}
            </section>
          </>
        ) : (
          <>
            <header style={{ marginBottom: CSP_SECTION_GAP }}>
              <h1 className="text-2xl font-semibold">You&apos;re almost ready to start earning.</h1>
              <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>Complete verification to unlock jobs and payouts.</p>
            </header>
            <section className="space-y-3" style={{ marginBottom: CSP_SECTION_GAP }}>
              {checklist.map((item) => (
                <div key={item.label} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)", padding: CSP_CARD_PADDING }}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.label}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium">{item.status}</span>
                  </div>
                </div>
              ))}
            </section>
            <button type="button" onClick={() => navigate("/csp/dashboard/application")} className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-90" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Finish verification</button>
            <p className="mt-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Approval protects customers and protects you.</p>
          </>
        )
      ) : (
        <>
          <header style={{ marginBottom: CSP_SECTION_GAP }}>
            <h1 className="text-2xl font-semibold">Home</h1>
            <p className="mt-1 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Your work at a glance.</p>
          </header>

          {missedJobs.length > 0 ? (
            <section style={{ marginBottom: CSP_SECTION_GAP }}>
              <button
                type="button"
                onClick={() => navigate("/csp/dashboard/jobs")}
                className="w-full rounded-2xl border border-amber-400/25 bg-amber-950/20 p-4 text-left"
              >
                <p className="text-sm font-semibold text-amber-200">{missedJobs.length} visit{missedJobs.length === 1 ? "" : "s"} need rescheduling</p>
                <p className="mt-1 text-xs leading-5 text-amber-100/75">Past scheduled dates are no longer counted as active work. Open Jobs to repair the schedule with the household.</p>
              </button>
            </section>
          ) : null}

          <section style={{ marginBottom: CSP_SECTION_GAP }}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Next visit</h2>
              <button type="button" onClick={() => navigate("/csp/dashboard/jobs")} className="text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>All jobs</button>
            </div>
            {loading ? (
              <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)", padding: CSP_CARD_PADDING }}>
                <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading your schedule...</p>
              </div>
            ) : nextJob ? (
              <button
                type="button"
                onClick={() => navigate(`/csp/dashboard/jobs/${nextJob.id}`)}
                className="w-full rounded-2xl border text-left transition-opacity hover:opacity-90"
                style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)", padding: CSP_CARD_PADDING }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold">{formatDateTime(nextJob.scheduled_start)}</p>
                    <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{readableJobStatus(nextJob.status)}</p>
                  </div>
                  <ArrowRight size={18} className="mt-1 shrink-0" style={{ color: CSP_PRIMARY_BUTTON }} />
                </div>
              </button>
            ) : (
              <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)", padding: CSP_CARD_PADDING }}>
                <p className="text-sm font-medium">No scheduled visits right now.</p>
                <button type="button" onClick={() => navigate("/csp/dashboard/jobs")} className="mt-2 text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>See available jobs →</button>
              </div>
            )}
          </section>

          <section style={{ marginBottom: CSP_SECTION_GAP }}>
            <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Work</h2>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => navigate("/csp/dashboard/jobs")} className="rounded-2xl border p-4 text-left" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)" }}>
                <BriefcaseBusiness size={19} style={{ color: CSP_PRIMARY_BUTTON }} />
                <p className="mt-3 text-xl font-semibold">{loading ? "—" : activeJobs.length}</p>
                <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Your jobs</p>
              </button>
              <button type="button" onClick={() => navigate("/csp/dashboard/jobs")} className="rounded-2xl border p-4 text-left" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)" }}>
                <Compass size={19} style={{ color: CSP_PRIMARY_BUTTON }} />
                <p className="mt-3 text-xl font-semibold">{loading ? "—" : availableJobs.length}</p>
                <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Available nearby</p>
              </button>
            </div>
          </section>

          {error ? (
            <section style={{ marginBottom: CSP_SECTION_GAP }}>
              <div className="rounded-2xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">{error}</div>
            </section>
          ) : availableJobs.length > 0 ? (
            <section style={{ marginBottom: CSP_SECTION_GAP }}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Available near you</h2>
                <button type="button" onClick={() => navigate("/csp/dashboard/jobs")} className="text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>View all</button>
              </div>
              <div className="space-y-2">
                {availableJobs.slice(0, 2).map((job) => (
                  <button key={job.id} type="button" onClick={() => navigate(`/csp/dashboard/jobs/${job.id}`)} className="flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)" }}>
                    <div>
                      <p className="text-sm font-medium">{formatDateTime(job.scheduled_start)}</p>
                      <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{formatDistance(job.distance_meters)}</p>
                    </div>
                    <ArrowRight size={17} className="shrink-0" style={{ color: CSP_PRIMARY_BUTTON }} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section style={{ marginBottom: CSP_SECTION_GAP }}>
            <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Quick actions</h2>
            <div className="overflow-hidden rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)" }}>
              <button type="button" onClick={() => navigate("/csp/dashboard/calendar?tab=availability")} className="flex w-full items-center gap-3 px-4 py-4 text-left">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}18` }}><CalendarClock size={18} style={{ color: CSP_PRIMARY_BUTTON }} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Availability</p>
                  <p className="mt-0.5 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Update when you want to work</p>
                </div>
                <ArrowRight size={16} className="shrink-0" style={{ color: CSP_TEXT_SECONDARY }} />
              </button>
              <div className="border-t border-white/10" />
              <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.home)} className="flex w-full items-center gap-3 px-4 py-4 text-left">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}18` }}><Compass size={18} style={{ color: CSP_PRIMARY_BUTTON }} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Growth</p>
                  <p className="mt-0.5 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Goals, progress, and opportunities</p>
                </div>
                <ArrowRight size={16} className="shrink-0" style={{ color: CSP_TEXT_SECONDARY }} />
              </button>
            </div>
          </section>

          <section style={{ marginBottom: CSP_SECTION_GAP }}>
            <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Build your practice</h2>
            {existingClientAction}
          </section>
        </>
      )}
    </div>
  );
}
