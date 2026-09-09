import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { findAvailableJobsForProvider, listMyJobsAsProvider, type AvailableJob } from "../../../lib/bookingApi";
import { useProfile } from "../../../lib/useProfile";
import type { Booking } from "../../../domain/booking";
import { supabase } from "../../../lib/supabase";
import { isCurrentProviderWork, isMissedAcceptedVisit } from "../../../lib/bookingServiceDay";
import { AppEmptyState, AppList, AppListRow, AppPageHeader, AppTabs } from "@/components/shared/AppUi";
import { CSP_PRIMARY_BUTTON, CSP_TEXT_PRIMARY, CSP_TEXT_SECONDARY } from "@/theme/cspTheme";
import { useUnreadBookingMessageIds } from "../../../hooks/useUnreadBookingMessageIds";

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

function formatDistance(meters: number | undefined): string {
  if (meters == null) return "Distance unavailable";
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
      trailing={<span className="text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>View</span>}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    Promise.all([findAvailableJobsForProvider(providerId, 100), listMyJobsAsProvider(), loadFinancialsAndResolution()])
      .then(([av, my]) => {
        setAvailable(av);
        setMyJobs(my);
        if (my.some((booking) => isCurrentProviderWork(booking) || isMissedAcceptedVisit(booking))) setTab("active");
      })
      .catch((err) => setError(err?.message ?? "Failed to load jobs"))
      .finally(() => setLoading(false));
  }, [profile?.id, profile?.role, marketplaceEnabled]);

  const active = myJobs.filter((booking) => isCurrentProviderWork(booking));
  const missed = myJobs.filter((booking) => isMissedAcceptedVisit(booking) && !resolvedMissedIds.has(booking.id));
  const completed = myJobs.filter((booking) => booking.status === "completed_by_provider" || booking.status === "confirmed");

  if (loading) return <div className="min-h-[40vh] flex items-center justify-center text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading jobs…</div>;
  if (error) return <div className="min-h-[40vh] flex items-center text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Unable to load jobs. Please try again.</div>;

  return (
    <div className="relative" style={{ color: CSP_TEXT_PRIMARY }}>
      <AppPageHeader
        tone="provider"
        title="Jobs"
        description={marketplaceEnabled ? "Work to consider, work in progress, and completed visits." : "Your existing-client work stays here while marketplace access is pending."}
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
          { value: "available", label: "Available", count: marketplaceEnabled ? available.length : undefined },
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
        ) : available.length === 0 ? (
          <AppEmptyState tone="provider" title="No jobs available right now" description="New jobs will appear when they fit your service area." />
        ) : (
          <AppList tone="provider">
            {available.map((job, index) => <AvailableJobRow key={job.id} job={job} divided={index > 0} onOpen={(id) => navigate(`/csp/dashboard/jobs/${id}`)} />)}
          </AppList>
        )
      ) : null}

      {tab === "active" ? (
        active.length === 0 ? (
          <AppEmptyState tone="provider" title="No active jobs" description={marketplaceEnabled ? "Available work is under the Available tab." : "Existing-client work will appear here when scheduled."} />
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
    </div>
  );
}
