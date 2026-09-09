import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { acceptBookingAsProvider, findAvailableJobsForProvider, listMyJobsAsProvider, type AvailableJob } from "../../../lib/bookingApi";
import { getMyNewMarketplaceIntake, getMyProviderOpportunity, type ProviderOpportunity } from "../../../lib/providerOpportunityApi";
import { useProfile } from "../../../lib/useProfile";
import type { Booking } from "../../../domain/booking";
import { supabase } from "../../../lib/supabase";
import { isCurrentProviderWork, isMissedAcceptedVisit } from "../../../lib/bookingServiceDay";
import { AppEmptyState, AppList, AppListRow, AppPageHeader, AppTabs } from "@/components/shared/AppUi";
import BottomSheet, { type Snap } from "../../../components/ui/BottomSheet";
import { CSP_PRIMARY_BUTTON, CSP_TEXT_PRIMARY, CSP_TEXT_SECONDARY } from "@/theme/cspTheme";
import { useUnreadBookingMessageIds } from "../../../hooks/useUnreadBookingMessageIds";
import { customerFacingServiceLabel } from "../../../lib/serviceCatalog";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return "Distance unavailable";
  const miles = meters / 1609.34;
  if (miles < 0.1) return "< 0.1 mi";
  return `${miles.toFixed(1)} mi`;
}

function providerStatusLabel(booking: Booking): string {
  if (isMissedAcceptedVisit(booking)) return "Needs rescheduling";
  if (booking.status === "accepted") return "Scheduled";
  if (booking.status === "in_progress") return "In progress";
  if (booking.status === "completed_by_provider") return "Awaiting confirmation";
  if (booking.status === "confirmed") return "Completed";
  if (booking.status === "disputed") return "Needs attention";
  return booking.status.replaceAll("_", " ");
}

type BookingFinancial = {
  price_cents: number;
  platform_fee_cents: number | null;
};

type Tab = "available" | "active" | "completed";

function AvailableJobRow({ job, divided = false, onOpen }: { job: AvailableJob; divided?: boolean; onOpen: (id: string) => void }) {
  return (
    <AppListRow
      tone="provider"
      divided={divided}
      title={`${formatDate(job.scheduled_start)} · ${formatTime(job.scheduled_start)}`}
      description={`${formatDistance(job.distance_meters)} · Customer total $${((job.price_cents ?? 0) / 100).toFixed(0)}`}
      trailing={<span className="text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>Consider</span>}
      onClick={() => onOpen(job.id)}
    />
  );
}

function MyJobRow({ booking, financial, hasUnreadMessages, divided = false }: { booking: Booking; financial: BookingFinancial | null; hasUnreadMessages: boolean; divided?: boolean }) {
  const navigate = useNavigate();
  const grossCents = financial?.price_cents ?? booking.price_cents ?? 0;
  const earningCents = Math.max(0, grossCents - (financial?.platform_fee_cents ?? 0));
  return (
    <AppListRow
      tone="provider"
      divided={divided}
      title={booking.address}
      description={
        <div>
          <p>{formatDate(booking.scheduled_start)} · {formatTime(booking.scheduled_start)}</p>
          <p className="mt-0.5">{providerStatusLabel(booking)} · Expected ${(earningCents / 100).toFixed(0)}</p>
        </div>
      }
      trailing={
        <div className="flex items-center gap-2">
          {hasUnreadMessages ? <span className="h-2 w-2 rounded-full bg-[#0A84FF]" aria-hidden /> : null}
          <span className="text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>Open</span>
        </div>
      }
      onClick={() => navigate(`/csp/dashboard/jobs/${booking.id}`)}
    />
  );
}

export default function JobsScreen() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { unreadBookingIds } = useUnreadBookingMessageIds();
  const [tab, setTab] = useState<Tab>("available");
  const [available, setAvailable] = useState<AvailableJob[]>([]);
  const [myJobs, setMyJobs] = useState<Booking[]>([]);
  const [financials, setFinancials] = useState<Record<string, BookingFinancial>>({});
  const [resolvedMissedIds, setResolvedMissedIds] = useState<Set<string>>(new Set());
  const [acceptingNewMarketplaceWork, setAcceptingNewMarketplaceWork] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [opportunitySnap, setOpportunitySnap] = useState<Snap>("medium");
  const [opportunityLoading, setOpportunityLoading] = useState(false);
  const [opportunity, setOpportunity] = useState<ProviderOpportunity | null>(null);
  const [opportunityError, setOpportunityError] = useState<string | null>(null);
  const [opportunityAccepting, setOpportunityAccepting] = useState(false);

  const marketplaceEnabled = profile?.marketplace_access === true;

  useEffect(() => {
    const providerId = profile?.role === "csp" ? profile.id : null;
    if (!providerId) {
      setAvailable([]);
      setMyJobs([]);
      setFinancials({});
      setResolvedMissedIds(new Set());
      setLoading(false);
      return;
    }

    async function loadFinancialsAndResolution() {
      const { data, error: financialError } = await supabase
        .from("bookings")
        .select("id, price_cents, platform_fee_cents, missed_visit_resolution")
        .eq("provider_id", providerId);
      if (financialError) throw financialError;
      const next: Record<string, BookingFinancial> = {};
      const resolved = new Set<string>();
      for (const row of data ?? []) {
        const id = String(row.id);
        next[id] = {
          price_cents: Number(row.price_cents ?? 0),
          platform_fee_cents: row.platform_fee_cents == null ? null : Number(row.platform_fee_cents),
        };
        if (row.missed_visit_resolution) resolved.add(id);
      }
      setFinancials(next);
      setResolvedMissedIds(resolved);
    }

    setError(null);
    setLoading(true);
    if (!marketplaceEnabled) {
      setAvailable([]);
      Promise.all([listMyJobsAsProvider(), loadFinancialsAndResolution()])
        .then(([my]) => {
          setMyJobs(my);
          if (my.some((booking) => isCurrentProviderWork(booking) || isMissedAcceptedVisit(booking))) setTab("active");
        })
        .catch((err) => {
          setMyJobs([]);
          setFinancials({});
          setResolvedMissedIds(new Set());
          setError(err?.message ?? "Failed to load jobs");
        })
        .finally(() => setLoading(false));
      return;
    }

    Promise.all([
      findAvailableJobsForProvider(providerId, 100),
      listMyJobsAsProvider(),
      loadFinancialsAndResolution(),
      getMyNewMarketplaceIntake(),
    ])
      .then(([av, my, _financials, intakeOn]) => {
        setAvailable(av);
        setMyJobs(my);
        setAcceptingNewMarketplaceWork(intakeOn);
        if (my.some((booking) => isCurrentProviderWork(booking) || isMissedAcceptedVisit(booking))) setTab("active");
      })
      .catch((err) => setError(err?.message ?? "Failed to load jobs"))
      .finally(() => setLoading(false));
  }, [profile?.id, profile?.role, marketplaceEnabled]);

  const active = myJobs.filter((booking) => isCurrentProviderWork(booking));
  const missed = myJobs.filter((booking) => isMissedAcceptedVisit(booking) && !resolvedMissedIds.has(booking.id));
  const completed = myJobs.filter((booking) => booking.status === "completed_by_provider" || booking.status === "confirmed");

  async function openOpportunity(id: string) {
    setOpportunityOpen(true);
    setOpportunitySnap("medium");
    setOpportunity(null);
    setOpportunityError(null);
    setOpportunityLoading(true);
    try {
      const detail = await getMyProviderOpportunity(id);
      if (!detail) {
        setOpportunityError("This opportunity is no longer available to you.");
        setAvailable((current) => current.filter((job) => job.id !== id));
      } else {
        setOpportunity(detail);
      }
    } catch {
      setOpportunityError("We couldn't load this opportunity. Try again.");
    } finally {
      setOpportunityLoading(false);
    }
  }

  async function acceptOpportunity() {
    if (!opportunity || opportunityAccepting) return;
    setOpportunityAccepting(true);
    setOpportunityError(null);
    try {
      await acceptBookingAsProvider(opportunity.id);
      setAvailable((current) => current.filter((job) => job.id !== opportunity.id));
      setOpportunityOpen(false);
      navigate(`/csp/dashboard/jobs/${opportunity.id}`);
    } catch (acceptError) {
      const message = acceptError instanceof Error ? acceptError.message : String(acceptError ?? "");
      if (message.includes("booking_already_assigned") || message.includes("invalid_status_for_accept")) {
        setOpportunityError("This opportunity was already accepted and is no longer available.");
        setAvailable((current) => current.filter((job) => job.id !== opportunity.id));
      } else if (message.includes("provider_new_marketplace_work_paused")) {
        setOpportunityError("New marketplace work is paused in your Work preferences.");
        setAcceptingNewMarketplaceWork(false);
      } else {
        setOpportunityError("We couldn't accept this opportunity. Its availability may have changed.");
      }
    } finally {
      setOpportunityAccepting(false);
    }
  }

  if (loading) return <div className="min-h-[40vh] flex items-center justify-center text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading jobs…</div>;
  if (error) return <div className="min-h-[40vh] flex items-center text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Unable to load jobs. Please try again.</div>;

  return (
    <div className="relative" style={{ color: CSP_TEXT_PRIMARY }}>
      <AppPageHeader
        tone="provider"
        title="Jobs"
        description={marketplaceEnabled ? "Opportunities to consider, work you've accepted, and completed visits." : "Your existing-client work stays here while marketplace access is pending."}
      />

      {missed.length > 0 ? (
        <section className="mb-5 border-y border-amber-400/25 bg-amber-950/20 py-4">
          <p className="text-sm font-semibold text-amber-200">{missed.length} visit{missed.length === 1 ? "" : "s"} need attention</p>
          <p className="mt-1 text-xs leading-5 text-amber-100/75">Open the visit to agree on a new future time with the household.</p>
          <div className="mt-3">
            <AppList tone="provider">
              {missed.map((booking, index) => (
                <MyJobRow key={booking.id} booking={booking} financial={financials[booking.id] ?? null} hasUnreadMessages={unreadBookingIds.has(booking.id)} divided={index > 0} />
              ))}
            </AppList>
          </div>
        </section>
      ) : null}

      <AppTabs
        tone="provider"
        value={tab}
        onChange={setTab}
        items={[
          { value: "available", label: "Available", count: marketplaceEnabled && acceptingNewMarketplaceWork ? available.length : undefined },
          { value: "active", label: "Active", count: active.length },
          { value: "completed", label: "Completed", count: completed.length },
        ]}
      />

      {tab === "available" ? (
        !marketplaceEnabled ? (
          <div className="border-y border-white/10 py-5">
            <p className="text-sm font-semibold">Marketplace access is pending</p>
            <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Existing-client bookings still appear under Active and Completed.</p>
            <button type="button" onClick={() => navigate("/csp/dashboard/existing-clients")} className="mt-3 text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>Bring an existing client</button>
          </div>
        ) : !acceptingNewMarketplaceWork ? (
          <div className="border-y border-white/10 py-5">
            <p className="text-sm font-semibold">New marketplace work is paused</p>
            <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Booked visits and existing household relationships are unchanged. Turn new opportunities back on whenever you want.</p>
            <button type="button" onClick={() => navigate("/csp/dashboard/profile")} className="mt-3 text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>Open Work preferences</button>
          </div>
        ) : available.length === 0 ? (
          <AppEmptyState tone="provider" title="No opportunities available right now" description="New opportunities will appear when they fit your service area, preferences, and calendar." />
        ) : (
          <>
            <p className="mb-3 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Consider any opportunity that fits. Passing on or ignoring one does not affect your standing.</p>
            <AppList tone="provider">
              {available.map((job, index) => <AvailableJobRow key={job.id} job={job} divided={index > 0} onOpen={(id) => void openOpportunity(id)} />)}
            </AppList>
          </>
        )
      ) : null}

      {tab === "active" ? (
        active.length === 0 ? (
          <AppEmptyState tone="provider" title="No active jobs" description={marketplaceEnabled ? "Work you choose to accept will appear here." : "Existing-client work will appear here when scheduled."} />
        ) : (
          <AppList tone="provider">
            {active.map((booking, index) => <MyJobRow key={booking.id} booking={booking} financial={financials[booking.id] ?? null} hasUnreadMessages={unreadBookingIds.has(booking.id)} divided={index > 0} />)}
          </AppList>
        )
      ) : null}

      {tab === "completed" ? (
        completed.length === 0 ? (
          <AppEmptyState tone="provider" title="No completed jobs yet" />
        ) : (
          <AppList tone="provider">
            {completed.map((booking, index) => <MyJobRow key={booking.id} booking={booking} financial={financials[booking.id] ?? null} hasUnreadMessages={unreadBookingIds.has(booking.id)} divided={index > 0} />)}
          </AppList>
        )
      ) : null}

      <BottomSheet
        open={opportunityOpen}
        onClose={() => setOpportunityOpen(false)}
        snap={opportunitySnap}
        setSnap={setOpportunitySnap}
        title="Marketplace opportunity"
        subtitle="Review the service facts before you choose. Household details unlock only after acceptance."
        tone="dark"
      >
        <div className="space-y-5 px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6">
          {opportunityLoading ? <p className="py-8 text-center text-sm text-white/60">Loading opportunity…</p> : null}
          {opportunity ? (
            <>
              {opportunity.requestedForMe ? <div className="border-y border-emerald-400/20 bg-emerald-400/5 py-3 text-xs font-medium text-emerald-200">This household requested you specifically.</div> : null}
              <div className="divide-y divide-white/10 border-y border-white/10">
                <div className="py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Service</p><p className="mt-1 text-sm font-semibold text-white">{customerFacingServiceLabel(opportunity.serviceType)}</p></div>
                <div className="py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">When</p><p className="mt-1 text-sm font-semibold text-white">{formatDate(opportunity.scheduledStart)} · {formatTime(opportunity.scheduledStart)}</p></div>
                <div className="py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Area</p><p className="mt-1 text-sm font-semibold text-white">{opportunity.serviceArea} · {formatDistance(opportunity.distanceMeters)}</p></div>
                <div className="py-3"><p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">Expected earnings</p><p className="mt-1 text-lg font-semibold text-white">${(opportunity.expectedEarningsCents / 100).toFixed(0)}</p><p className="mt-1 text-xs text-white/50">Customer total ${(opportunity.customerTotalCents / 100).toFixed(0)} · Cleanr fee ${(opportunity.platformFeeCents / 100).toFixed(0)}</p></div>
              </div>
              <p className="text-xs leading-5 text-white/60">Accepting adds this paid visit to your schedule and unlocks the household details needed to fulfill it. You are not required to accept this opportunity, and passing on it does not affect your standing.</p>
              <button type="button" onClick={() => void acceptOpportunity()} disabled={opportunityAccepting} className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
                {opportunityAccepting ? "Accepting…" : "Accept opportunity"}
              </button>
            </>
          ) : null}
          {opportunityError ? <div className="border-y border-red-400/20 bg-red-400/5 py-3 text-xs leading-5 text-red-200">{opportunityError}</div> : null}
          {!opportunityLoading && !opportunity ? <button type="button" onClick={() => setOpportunityOpen(false)} className="w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white">Close</button> : null}
        </div>
      </BottomSheet>
    </div>
  );
}
