import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarClock, Compass, Handshake } from "lucide-react";
import { findAvailableJobsForProvider, listMyJobsAsProvider, type AvailableJob } from "../../../lib/bookingApi";
import type { Booking } from "../../../domain/booking";
import { isCurrentProviderWork, isMissedAcceptedVisit } from "../../../lib/bookingServiceDay";
import { useStableSessionProfile } from "@/hooks/useStableSessionProfile";
import { profileToProviderFlow, shouldShowMarketplacePendingPanel } from "@/lib/providerFlow";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
import {
  AppEmptyState,
  AppList,
  AppListRow,
  AppMetricStrip,
  AppPageHeader,
  AppPanel,
  AppSectionHeader,
} from "@/components/shared/AppUi";
import { CSP_PRIMARY_BUTTON, CSP_TEXT_PRIMARY, CSP_TEXT_SECONDARY } from "@/theme/cspTheme";

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
  return `${(meters / 1609.34).toFixed(1)} mi away`;
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
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load dashboard"))
      .finally(() => setLoading(false));
  }, [displayProfile?.id, displayProfile?.role, isUnlocked]);

  const checklist = useMemo(() => {
    if (!displayProfile) return [];
    return [
      { label: "CSP terms", status: displayProfile.csp_terms_accepted_at ? "Verified" : "Not started" },
      { label: "Insurance (optional)", status: toDisplayStatus(displayProfile.insurance_status) },
      { label: "ID verification", status: toDisplayStatus(displayProfile.identity_status) },
      { label: "Background check", status: toDisplayStatus(displayProfile.background_check_status) },
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
    console.info(isUnlocked ? "[today-screen] render live" : "[today-screen] render locked");
  }, [showInitialBlocking, displayProfile?.id, isUnlocked, isOnboarded]);

  const marketplaceReviewRows = [
    { label: "Application", badge: "Approved" },
    { label: "Provider profile", badge: "Complete" },
    { label: "Marketplace access", badge: "Pending" },
    { label: "Open-market jobs", badge: "Not available yet" },
  ] as const;

  const existingClientRow = (
    <AppListRow
      tone="provider"
      title="Bring an existing client"
      description="Invite a household that already works with you."
      leading={
        <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}18` }}>
          <Handshake size={18} style={{ color: CSP_PRIMARY_BUTTON }} />
        </div>
      }
      onClick={() => navigate("/csp/dashboard/existing-clients")}
    />
  );

  if (showInitialBlocking || !displayProfile) return null;

  if (!isUnlocked) {
    return (
      <div className="relative min-h-[60vh]" style={{ color: CSP_TEXT_PRIMARY }}>
        {showMarketplacePending ? (
          <>
            <AppPageHeader
              tone="provider"
              eyebrow="Marketplace"
              title="You're approved."
              description="Marketplace access is next. You can still bring households you already serve into Cleanr now."
            />
            <AppList tone="provider">
              {marketplaceReviewRows.map((item, index) => (
                <AppListRow
                  key={item.label}
                  tone="provider"
                  divided={index > 0}
                  title={item.label}
                  trailing={<span className="text-xs font-medium" style={{ color: CSP_TEXT_SECONDARY }}>{item.badge}</span>}
                />
              ))}
            </AppList>
            <div className="mt-5">
              <AppList tone="provider">{existingClientRow}</AppList>
            </div>
          </>
        ) : (
          <>
            <AppPageHeader
              tone="provider"
              eyebrow="Provider setup"
              title="Finish verification"
              description="Complete the remaining steps to unlock jobs and payouts."
            />
            <AppList tone="provider">
              {checklist.map((item, index) => (
                <AppListRow
                  key={item.label}
                  tone="provider"
                  divided={index > 0}
                  title={item.label}
                  trailing={<span className="text-xs font-medium" style={{ color: item.status === "Verified" ? "#8DCC64" : CSP_TEXT_SECONDARY }}>{item.status}</span>}
                />
              ))}
            </AppList>
            <button
              type="button"
              onClick={() => navigate("/csp/dashboard/application")}
              className="mt-5 w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
            >
              Continue setup
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative min-h-[60vh]" style={{ color: CSP_TEXT_PRIMARY }}>
      <AppPageHeader tone="provider" title="Home" description="Your next work and what needs attention." />

      {missedJobs.length > 0 ? (
        <button
          type="button"
          onClick={() => navigate("/csp/dashboard/jobs")}
          className="mb-5 w-full border-y border-amber-400/25 bg-amber-950/20 py-3 text-left"
        >
          <p className="text-sm font-semibold text-amber-200">{missedJobs.length} visit{missedJobs.length === 1 ? "" : "s"} need attention</p>
          <p className="mt-1 text-xs leading-5 text-amber-100/75">Open Jobs to repair the schedule with the household.</p>
        </button>
      ) : null}

      <section className="mb-6">
        <AppSectionHeader
          tone="provider"
          title="Next visit"
          action={<button type="button" onClick={() => navigate("/csp/dashboard/jobs")} className="text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>All jobs</button>}
        />
        {loading ? (
          <div className="border-y border-white/10 py-6 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading your schedule…</div>
        ) : nextJob ? (
          <button
            type="button"
            onClick={() => navigate(`/csp/dashboard/jobs/${nextJob.id}`)}
            className="w-full text-left"
          >
            <AppPanel tone="provider">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold tracking-[-0.02em]">{formatDateTime(nextJob.scheduled_start)}</p>
                  <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{readableJobStatus(nextJob.status)}</p>
                </div>
                <ArrowRight size={18} className="mt-1 shrink-0" style={{ color: CSP_PRIMARY_BUTTON }} />
              </div>
            </AppPanel>
          </button>
        ) : (
          <AppEmptyState
            tone="provider"
            title="No visit scheduled"
            description={availableJobs.length > 0 ? "There are jobs available nearby." : "New work will appear in Jobs when it's available."}
            action={<button type="button" onClick={() => navigate("/csp/dashboard/jobs")} className="text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>Open Jobs</button>}
          />
        )}
      </section>

      {!loading && (activeJobs.length > 0 || availableJobs.length > 0) ? (
        <section className="mb-6">
          <AppMetricStrip
            tone="provider"
            items={[
              { label: "Scheduled", value: activeJobs.length },
              { label: "Available nearby", value: availableJobs.length },
            ]}
          />
        </section>
      ) : null}

      {error ? (
        <div className="mb-6 border-y border-red-400/20 bg-red-400/5 py-3 text-sm text-red-200">{error}</div>
      ) : availableJobs.length > 0 ? (
        <section className="mb-6">
          <AppSectionHeader
            tone="provider"
            title="Available near you"
            action={<button type="button" onClick={() => navigate("/csp/dashboard/jobs")} className="text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>View all</button>}
          />
          <AppList tone="provider">
            {availableJobs.slice(0, 2).map((job, index) => (
              <AppListRow
                key={job.id}
                tone="provider"
                divided={index > 0}
                title={formatDateTime(job.scheduled_start)}
                description={formatDistance(job.distance_meters)}
                onClick={() => navigate(`/csp/dashboard/jobs/${job.id}`)}
              />
            ))}
          </AppList>
        </section>
      ) : null}

      <section className="mb-6">
        <AppSectionHeader tone="provider" title="Manage" />
        <AppList tone="provider">
          <AppListRow
            tone="provider"
            title="Availability"
            description="Update when you want to work."
            leading={<div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}18` }}><CalendarClock size={18} style={{ color: CSP_PRIMARY_BUTTON }} /></div>}
            onClick={() => navigate("/csp/dashboard/calendar?tab=availability")}
          />
          <AppListRow
            tone="provider"
            divided
            title="Growth"
            description="Goals, progress, and opportunities."
            leading={<div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}18` }}><Compass size={18} style={{ color: CSP_PRIMARY_BUTTON }} /></div>}
            onClick={() => navigate(CSP_GROWTH_ROUTES.home)}
          />
          {existingClientRow}
        </AppList>
      </section>
    </div>
  );
}
