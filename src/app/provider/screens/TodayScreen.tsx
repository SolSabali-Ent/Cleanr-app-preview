import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarClock, Compass, Handshake } from "lucide-react";
import { findAvailableJobsForProvider, listMyJobsAsProvider, type AvailableJob } from "../../../lib/bookingApi";
import {
  listMyRecurringCleaningPlans,
  type RecurringCleaningPlan,
} from "../../../lib/recurringCleaningApi";
import type { Booking } from "../../../domain/booking";
import { isCurrentProviderWork, isMissedAcceptedVisit } from "../../../lib/bookingServiceDay";
import { customerFacingServiceLabel } from "../../../lib/serviceCatalog";
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

function cadenceLabel(cadence: RecurringCleaningPlan["cadence"]): string {
  if (cadence === "weekly") return "Every week";
  if (cadence === "bi-weekly") return "Every 2 weeks";
  return "Every month";
}

function recurringAddress(value: Record<string, unknown>): string {
  const text = (key: string) => String(value?.[key] ?? "").trim();
  const raw = text("address") || text("formatted_address") || text("formattedAddress");
  if (raw) return raw;

  const street = text("street") || text("line1") || text("address_line_1");
  const unit = text("unit") || text("line2") || text("address_line_2");
  const city = text("city");
  const state = text("state");
  const zip = text("zip_code") || text("zip");
  const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [street, unit, cityStateZip].filter(Boolean).join(", ") || "Service address";
}

export default function TodayScreen() {
  const { displayProfile, showInitialBlocking, stableOk, profileLoading } = useStableSessionProfile();
  const navigate = useNavigate();
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [myJobs, setMyJobs] = useState<Booking[]>([]);
  const [recurringPlans, setRecurringPlans] = useState<RecurringCleaningPlan[]>([]);
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
      setRecurringPlans([]);
      setLoading(false);
      return;
    }
    const providerId = displayProfile.role === "csp" ? displayProfile.id : null;
    if (!providerId || !isUnlocked) {
      setAvailableJobs([]);
      setMyJobs([]);
      setRecurringPlans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([
      findAvailableJobsForProvider(providerId, 20),
      listMyJobsAsProvider(),
      listMyRecurringCleaningPlans(),
    ])
      .then(([available, mine, plans]) => {
        setAvailableJobs(available);
        setMyJobs(mine);
        setRecurringPlans(plans.filter((plan) => plan.preferredProviderId === providerId));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load your home screen"))
      .finally(() => setLoading(false));
  }, [displayProfile?.id, displayProfile?.role, isUnlocked]);

  const checklist = useMemo(() => {
    if (!displayProfile) return [];
    return [
      { label: "Provider terms", status: displayProfile.csp_terms_accepted_at ? "Verified" : "Not started" },
      { label: "Insurance (optional)", status: toDisplayStatus(displayProfile.insurance_status) },
      { label: "ID check", status: toDisplayStatus(displayProfile.identity_status) },
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
  const hasActiveRecurringPlan = recurringPlans.some((plan) => plan.status === "active");

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
              eyebrow="Provider setup"
              title="You're approved."
              description="Cleanr is finishing the last checks before we can show you new jobs. You can already bring clients you serve into Cleanr."
            />
            <AppList tone="provider">
              <AppListRow
                tone="provider"
                title="Provider setup"
                description="Your application and required setup are complete."
                trailing={<span className="text-xs font-medium" style={{ color: "#8DCC64" }}>Complete</span>}
              />
              <AppListRow
                tone="provider"
                divided
                title="New Cleanr jobs"
                description="These will appear after your final checks are complete."
                trailing={<span className="text-xs font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Not available yet</span>}
              />
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
              title="Finish setup"
              description="Finish the last steps so you can see new Cleanr jobs and get paid through Cleanr."
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
      <AppPageHeader tone="provider" title="Home" description="Your accepted work, clients, and new Cleanr jobs." />

      {missedJobs.length > 0 ? (
        <button
          type="button"
          onClick={() => navigate("/csp/dashboard/jobs")}
          className="mb-5 w-full border-y border-amber-400/25 bg-amber-950/20 py-3 text-left"
        >
          <p className="text-sm font-semibold text-amber-200">{missedJobs.length} visit{missedJobs.length === 1 ? "" : "s"} need attention</p>
          <p className="mt-1 text-xs leading-5 text-amber-100/75">Open Jobs to fix the schedule with the household.</p>
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
            title={hasActiveRecurringPlan ? "No confirmed visit" : "No visit scheduled"}
            description={hasActiveRecurringPlan
              ? "Your recurring client is still active. The next expected date is below, but it is not booked yet."
              : availableJobs.length > 0
                ? "There are Cleanr jobs nearby."
                : "New jobs will appear in Jobs when they fit your choices."}
            action={<button type="button" onClick={() => navigate("/csp/dashboard/jobs")} className="text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>Open Jobs</button>}
          />
        )}
      </section>

      {!loading && recurringPlans.length > 0 ? (
        <section className="mb-6">
          <AppSectionHeader tone="provider" title="Recurring clients" />
          <div className="space-y-3">
            {recurringPlans.map((plan) => {
              const confirmedBooking = plan.currentBookingId
                ? activeJobs.find((job) => job.id === plan.currentBookingId) ?? null
                : null;
              const paused = plan.status === "paused";
              return (
                <AppPanel key={plan.id} tone="provider">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}18` }}>
                      <CalendarClock size={18} style={{ color: CSP_PRIMARY_BUTTON }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{customerFacingServiceLabel(plan.serviceType)}</p>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: paused ? "rgba(255,255,255,0.08)" : `${CSP_PRIMARY_BUTTON}18`,
                            color: paused ? CSP_TEXT_SECONDARY : CSP_PRIMARY_BUTTON,
                          }}
                        >
                          {paused ? "Paused" : "Active"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>{cadenceLabel(plan.cadence)}</p>
                      <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{recurringAddress(plan.serviceAddress)}</p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-white/10 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: CSP_TEXT_SECONDARY }}>
                      {confirmedBooking ? "Next confirmed visit" : paused ? "Expected after resume" : "Next expected"}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{formatDateTime(confirmedBooking?.scheduled_start ?? plan.nextExpectedAt)}</p>
                    <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                      {confirmedBooking
                        ? "This visit is booked."
                        : paused
                          ? "This recurring cleaning is paused."
                          : "Expected cadence, not a confirmed booking yet."}
                    </p>
                  </div>

                  {confirmedBooking ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/csp/dashboard/jobs/${confirmedBooking.id}`)}
                      className="mt-3 flex w-full items-center justify-between border-t border-white/10 pt-3 text-left"
                    >
                      <span className="text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>Open visit</span>
                      <ArrowRight size={16} style={{ color: CSP_PRIMARY_BUTTON }} />
                    </button>
                  ) : null}
                </AppPanel>
              );
            })}
          </div>
        </section>
      ) : null}

      {!loading && (activeJobs.length > 0 || availableJobs.length > 0) ? (
        <section className="mb-6">
          <AppMetricStrip
            tone="provider"
            items={[
              { label: "Scheduled", value: activeJobs.length },
              { label: "New jobs", value: availableJobs.length },
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
            action={<button type="button" onClick={() => navigate("/csp/dashboard/jobs")} className="text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>Review</button>}
          />
          <AppList tone="provider">
            {availableJobs.slice(0, 2).map((job, index) => (
              <AppListRow
                key={job.id}
                tone="provider"
                divided={index > 0}
                title={formatDateTime(job.scheduled_start)}
                description={`${formatDistance(job.distance_meters)} · review before accepting`}
                onClick={() => navigate("/csp/dashboard/jobs")}
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
            title="North Star"
            description="Your goals, next steps, and work that can help."
            leading={<div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}18` }}><Compass size={18} style={{ color: CSP_PRIMARY_BUTTON }} /></div>}
            onClick={() => navigate(CSP_GROWTH_ROUTES.home)}
          />
          {existingClientRow}
        </AppList>
      </section>
    </div>
  );
}
