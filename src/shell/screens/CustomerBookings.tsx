import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listBookingsForCustomer } from "../../lib/bookingApi";
import {
  listMyRecurringCleaningPlans,
  resolveMyMissedVisitWithoutReschedule,
  updateMyRecurringCleaningPlan,
  type RecurringCleaningPlan,
} from "../../lib/recurringCleaningApi";
import { listMyVerifiedServiceAddresses, type CustomerServiceAddress } from "../../lib/customerServiceAddressApi";
import type { Booking } from "../../domain/booking";
import { CalendarClock, ChevronDown, ChevronRight, Pause, Play, Settings2 } from "lucide-react";
import { useUnreadBookingMessageIds } from "../../hooks/useUnreadBookingMessageIds";
import { customerFacingServiceLabel } from "../../lib/serviceCatalog";
import { isMissedAcceptedVisit } from "../../lib/bookingServiceDay";
import { supabase } from "../../lib/supabase";
import {
  isHistoryBookingStatus,
  isUpcomingBookingStatus,
  toCustomerBookingStatusLabel,
} from "../../lib/customerBookingStatus";
import { AppEmptyState, AppList, AppListRow, AppPageHeader, AppTabs } from "../../components/shared/AppUi";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function firstName(value: string | null | undefined): string | null {
  const clean = value?.trim();
  return clean ? clean.split(/\s+/)[0] : null;
}

function cadenceLabel(cadence: RecurringCleaningPlan["cadence"]): string {
  if (cadence === "weekly") return "Every week";
  if (cadence === "bi-weekly") return "Every 2 weeks";
  return "Every month";
}

function normalizedAddressParts(value: Record<string, unknown>) {
  const text = (key: string) => String(value[key] ?? "").trim();
  return {
    street: text("street").toLowerCase(),
    unit: text("unit").toLowerCase(),
    city: text("city").toLowerCase(),
    state: text("state").toUpperCase(),
    zip: (text("zip_code") || text("zip")).slice(0, 5),
  };
}

function planLocation(plan: RecurringCleaningPlan, addresses: CustomerServiceAddress[]) {
  const parts = normalizedAddressParts(plan.serviceAddress ?? {});
  const match = addresses.find((address) =>
    address.street.trim().toLowerCase() === parts.street &&
    (address.unit ?? "").trim().toLowerCase() === parts.unit &&
    address.city.trim().toLowerCase() === parts.city &&
    address.state.trim().toUpperCase() === parts.state &&
    address.zip.slice(0, 5) === parts.zip
  );

  const raw = String(plan.serviceAddress?.address ?? "").trim();
  const addressDisplay = match?.formattedAddress || raw || [parts.street, parts.unit, parts.city, parts.state, parts.zip].filter(Boolean).join(", ") || "Service address";
  return {
    label: match?.label?.trim() || "Service address",
    address: addressDisplay,
  };
}

type MissedMeta = {
  resolution: string | null;
  dueAt: string | null;
};

function BookingRow({
  booking,
  hasUnreadMessages,
  compact = false,
  forceNeedsResolution = false,
  closedMissed = false,
  divided = false,
}: {
  booking: Booking;
  hasUnreadMessages: boolean;
  compact?: boolean;
  forceNeedsResolution?: boolean;
  closedMissed?: boolean;
  divided?: boolean;
}) {
  const navigate = useNavigate();
  const statusStyles: Record<string, string> = {
    created: "bg-emerald-100 text-emerald-700",
    accepted: "bg-blue-100 text-blue-700",
    in_progress: "bg-amber-100 text-amber-700",
    completed_by_provider: "bg-slate-100 text-slate-700",
    confirmed: "bg-slate-100 text-slate-700",
    cancelled: "bg-slate-200 text-slate-700",
    disputed: "bg-rose-100 text-rose-700",
  };

  const statusLabel = closedMissed ? "Missed · Closed" : forceNeedsResolution ? "Missed · Needs resolution" : toCustomerBookingStatusLabel(booking.status);
  const statusClass = closedMissed ? "bg-slate-100 text-slate-700" : forceNeedsResolution ? "bg-amber-100 text-amber-800" : statusStyles[booking.status] ?? "bg-slate-100 text-slate-700";

  return (
    <AppListRow
      divided={divided}
      title={customerFacingServiceLabel(booking.service_type)}
      description={
        <div>
          <p>{formatDate(booking.scheduled_start)} · {formatTime(booking.scheduled_start)}</p>
          {!compact ? <p className="truncate">{booking.address}</p> : null}
          <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{statusLabel}</span>
        </div>
      }
      trailing={
        <div className="flex shrink-0 items-center gap-2">
          {hasUnreadMessages ? <span className="h-2 w-2 rounded-full bg-[#0A84FF]" aria-hidden /> : null}
          {booking.price_cents > 0 ? <span className="text-sm font-semibold text-[#0B1220]">${(booking.price_cents / 100).toFixed(0)}</span> : null}
          <ChevronRight className="h-4 w-4 text-[#98A2B3]" />
        </div>
      }
      onClick={() => navigate(`/app/bookings/${booking.id}`)}
    />
  );
}

function RecurringPlanCard({
  plan,
  currentBooking,
  addresses,
  busy,
  onUpdate,
}: {
  plan: RecurringCleaningPlan;
  currentBooking: Booking | null;
  addresses: CustomerServiceAddress[];
  busy: boolean;
  onUpdate: (planId: string, action: "pause" | "resume" | "end") => Promise<void>;
}) {
  const navigate = useNavigate();
  const cleanerName = firstName(plan.preferredProviderName);
  const paused = plan.status === "paused";
  const missedCurrentVisit = Boolean(currentBooking && isMissedAcceptedVisit(currentBooking));
  const hasScheduledVisit = Boolean(plan.currentBookingId && currentBooking && !missedCurrentVisit);
  const location = planLocation(plan, addresses);

  return (
    <div className="mb-3 rounded-2xl border border-[#CFE8C3] bg-[#F7FBF4] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#8DCC64]/15 text-[#166534]">
          <CalendarClock className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{customerFacingServiceLabel(plan.serviceType)}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${paused ? "bg-[#F2F4F7] text-[#667085]" : "bg-emerald-100 text-emerald-700"}`}>{paused ? "Paused" : "Active"}</span>
          </div>
          <p className="mt-1 text-sm text-[#475467]">{cadenceLabel(plan.cadence)}{cleanerName ? ` · ${cleanerName}` : ""}</p>
          <p className="mt-2 text-xs font-semibold text-[#344054]">{location.label}</p>
          <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[#667085]">{location.address}</p>
        </div>
      </div>

      {!missedCurrentVisit ? (
        <div className="mt-4 border-y border-[#DCEED7] py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#667085]">
            {hasScheduledVisit ? "Next visit" : paused ? "After you resume" : "Next expected"}
          </p>
          <p className="mt-1 text-sm font-semibold">{formatDate(plan.nextExpectedAt)} · {formatTime(plan.nextExpectedAt)}</p>
          {!hasScheduledVisit ? <p className="mt-1 text-xs text-[#667085]">Expected cadence, not a confirmed booking yet.</p> : null}
        </div>
      ) : (
        <p className="mt-4 border-y border-[#DCEED7] py-3 text-xs leading-5 text-[#667085]">
          This recurring plan stays active while the missed visit is resolved.
        </p>
      )}

      {plan.currentBookingId && !missedCurrentVisit ? (
        <button type="button" onClick={() => navigate(`/app/bookings/${plan.currentBookingId}`)} className="mt-3 flex w-full items-center justify-between py-2 text-left">
          <div>
            <p className="text-sm font-semibold">Open next visit</p>
            <p className="mt-0.5 text-xs text-[#667085]">View details or manage the visit.</p>
          </div>
          <ChevronRight className="h-4 w-4 text-[#667085]" />
        </button>
      ) : null}

      <details className="mt-2 border-t border-[#DCEED7] pt-2">
        <summary className="flex cursor-pointer list-none items-center justify-center gap-2 py-2 text-xs font-semibold text-[#475467] [&::-webkit-details-marker]:hidden">
          <Settings2 className="h-4 w-4" /> Manage recurring cleaning
        </summary>
        <div className="mt-2 grid gap-2">
          <button type="button" disabled={busy} onClick={() => void onUpdate(plan.id, paused ? "resume" : "pause")} className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "Resume recurring cleaning" : "Pause recurring cleaning"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("End this recurring cleaning? Your existing scheduled visit will not be canceled automatically.")) void onUpdate(plan.id, "end");
            }}
            className="min-h-[44px] rounded-xl px-3 py-2 text-sm font-medium text-[#B42318] disabled:opacity-50"
          >
            End recurring cleaning
          </button>
          <p className="text-center text-[10px] leading-4 text-[#98A2B3]">A visit already scheduled is managed separately.</p>
        </div>
      </details>
    </div>
  );
}

type BookingTab = "upcoming" | "history";

export function CustomerBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [plans, setPlans] = useState<RecurringCleaningPlan[]>([]);
  const [addresses, setAddresses] = useState<CustomerServiceAddress[]>([]);
  const [missedMeta, setMissedMeta] = useState<Map<string, MissedMeta>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [resolutionNotice, setResolutionNotice] = useState<string | null>(null);
  const [planBusyId, setPlanBusyId] = useState<string | null>(null);
  const [resolutionBusyId, setResolutionBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<BookingTab>("upcoming");
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(10);
  const { unreadBookingIds } = useUnreadBookingMessageIds();

  useEffect(() => {
    const missedQuery = supabase
      .from("bookings")
      .select("id,missed_visit_resolution,missed_visit_resolution_due_at")
      .not("missed_visit_resolution_due_at", "is", null);

    Promise.all([listBookingsForCustomer(), listMyRecurringCleaningPlans(), listMyVerifiedServiceAddresses().catch(() => []), missedQuery])
      .then(([bookingRows, planRows, addressRows, missedResult]) => {
        setBookings(bookingRows);
        setPlans(planRows);
        setAddresses(addressRows);
        const next = new Map<string, MissedMeta>();
        for (const row of missedResult.data ?? []) {
          next.set(String(row.id), {
            resolution: row.missed_visit_resolution ? String(row.missed_visit_resolution) : null,
            dueAt: row.missed_visit_resolution_due_at ? String(row.missed_visit_resolution_due_at) : null,
          });
        }
        setMissedMeta(next);
      })
      .catch((err) => setError(err?.message ?? "Failed to load bookings"))
      .finally(() => setLoading(false));
  }, []);

  const resolvedMissedIds = useMemo(
    () => new Set([...missedMeta.entries()].filter(([, meta]) => Boolean(meta.resolution)).map(([id]) => id)),
    [missedMeta]
  );

  const missed = useMemo(
    () => bookings.filter((booking) => isMissedAcceptedVisit(booking) && !resolvedMissedIds.has(booking.id)).sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()),
    [bookings, resolvedMissedIds]
  );
  const upcoming = useMemo(
    () => bookings
      .filter((booking) => isUpcomingBookingStatus(booking.status))
      .filter((booking) => !isMissedAcceptedVisit(booking))
      .filter((booking) => !(booking.status === "created" && (booking.price_cents ?? 0) <= 0))
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()),
    [bookings]
  );
  const history = useMemo(
    () => bookings
      .filter((booking) => isHistoryBookingStatus(booking.status) || resolvedMissedIds.has(booking.id))
      .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()),
    [bookings, resolvedMissedIds]
  );

  useEffect(() => {
    if (!loading && upcoming.length === 0 && plans.length === 0 && missed.length === 0 && history.length > 0) setTab("history");
  }, [loading, upcoming.length, plans.length, missed.length, history.length]);

  async function handlePlanUpdate(planId: string, action: "pause" | "resume" | "end") {
    if (planBusyId) return;
    setPlanBusyId(planId);
    setPlanError(null);
    try {
      const updated = await updateMyRecurringCleaningPlan(planId, action);
      setPlans((current) => action === "end" ? current.filter((plan) => plan.id !== planId) : current.map((plan) => (plan.id === planId ? updated : plan)));
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Could not update recurring cleaning.");
    } finally {
      setPlanBusyId(null);
    }
  }

  async function handleResolveMissed(bookingId: string) {
    if (resolutionBusyId) return;
    setResolutionBusyId(bookingId);
    setPlanError(null);
    setResolutionNotice(null);
    try {
      const result = await resolveMyMissedVisitWithoutReschedule(bookingId);
      setMissedMeta((current) => {
        const next = new Map(current);
        const existing = next.get(bookingId);
        next.set(bookingId, { resolution: "not_rescheduling", dueAt: existing?.dueAt ?? null });
        return next;
      });
      if (result.recurringPlanId) {
        setPlans((current) => current.map((plan) => plan.id === result.recurringPlanId ? { ...plan, currentBookingId: null, nextExpectedAt: result.nextExpectedAt ?? plan.nextExpectedAt } : plan));
      }
      setResolutionNotice(result.paymentReviewRequired ? "Visit closed. Your recurring cleaning stays active; payment remains under separate Cleanr review." : "Visit closed. Your recurring cleaning stays active on its normal cadence.");
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Could not close this missed visit.");
    } finally {
      setResolutionBusyId(null);
    }
  }

  if (loading) return <div className="py-6 text-sm text-[#667085]">Loading bookings…</div>;
  if (error) return <div className="py-6 text-sm text-red-500">{error}</div>;

  const bookingById = new Map(bookings.map((booking) => [booking.id, booking] as const));
  const recurringBookingIds = new Set(plans.flatMap((plan) => (plan.currentBookingId ? [plan.currentBookingId] : [])));
  const standaloneUpcoming = upcoming.filter((booking) => !recurringBookingIds.has(booking.id));
  const nextBooking = standaloneUpcoming[0] ?? null;
  const laterBookings = standaloneUpcoming.slice(1);
  const visibleLater = showAllUpcoming ? laterBookings : [];
  const visibleHistory = history.slice(0, historyLimit);
  const visiblePlans = showAllPlans ? plans : plans.slice(0, 1);

  return (
    <div className="text-[#0B1220]">
      <AppPageHeader title="Bookings" description="Your next visits and service history." />

      {resolutionNotice ? <div className="mb-4 border-y border-emerald-200 bg-emerald-50 py-3 text-xs leading-5 text-emerald-800">{resolutionNotice}</div> : null}

      {missed.length > 0 ? (
        <section className="mb-5 border-y border-amber-200 bg-amber-50 py-4">
          <p className="text-sm font-semibold text-amber-950">{missed.length} missed visit{missed.length === 1 ? "" : "s"} need resolution</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">Choose whether to reschedule or close each missed visit. Your recurring plan does not end automatically.</p>
          <div className="mt-3 space-y-3">
            {missed.map((booking) => {
              const dueAt = missedMeta.get(booking.id)?.dueAt ?? null;
              return (
                <div key={booking.id} className="rounded-2xl border border-amber-200 bg-white">
                  <AppList>
                    <BookingRow booking={booking} hasUnreadMessages={unreadBookingIds.has(booking.id)} compact forceNeedsResolution />
                  </AppList>
                  {dueAt ? <p className="border-t border-amber-100 px-4 py-2 text-[10px] font-medium text-amber-800">Resolve by {formatDate(dueAt)} · {formatTime(dueAt)}</p> : null}
                  <div className="grid grid-cols-2 border-t border-amber-100">
                    <button
                      type="button"
                      onClick={() => navigate(`/app/bookings/${booking.id}`)}
                      className="min-h-11 border-r border-amber-100 px-3 text-xs font-semibold text-[#0B1220]"
                    >
                      Reschedule visit
                    </button>
                    <button
                      type="button"
                      disabled={resolutionBusyId === booking.id}
                      onClick={() => {
                        if (window.confirm("Close this missed visit without rescheduling? This does not mark service complete or automatically decide any refund or payment review.")) void handleResolveMissed(booking.id);
                      }}
                      className="min-h-11 px-3 text-xs font-semibold text-amber-800 disabled:opacity-50"
                    >
                      {resolutionBusyId === booking.id ? "Updating…" : "Close this visit"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <AppTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "upcoming", label: "Upcoming", count: upcoming.length + plans.length },
          { value: "history", label: "History", count: history.length },
        ]}
      />

      {tab === "upcoming" ? (
        <section>
          {plans.length > 0 ? (
            <div className="mb-5">
              <p className="mb-2 text-sm font-medium text-[#667085]">Recurring</p>
              {visiblePlans.map((plan) => (
                <RecurringPlanCard
                  key={plan.id}
                  plan={plan}
                  currentBooking={plan.currentBookingId ? bookingById.get(plan.currentBookingId) ?? null : null}
                  addresses={addresses}
                  busy={planBusyId === plan.id}
                  onUpdate={handlePlanUpdate}
                />
              ))}
              {plans.length > 1 ? (
                <button type="button" onClick={() => setShowAllPlans((current) => !current)} className="flex w-full items-center justify-center gap-2 py-2 text-xs font-semibold text-[#667085]">
                  {showAllPlans ? "Show less" : `${plans.length - 1} more recurring`}
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAllPlans ? "rotate-180" : ""}`} />
                </button>
              ) : null}
              {planError ? <p className="mt-2 text-xs text-[#B42318]">{planError}</p> : null}
            </div>
          ) : null}

          {nextBooking ? (
            <div>
              <p className="mb-2 text-sm font-medium text-[#667085]">One-time visits</p>
              <AppList>
                <BookingRow booking={nextBooking} hasUnreadMessages={unreadBookingIds.has(nextBooking.id)} />
                {visibleLater.map((booking, index) => (
                  <BookingRow key={booking.id} booking={booking} hasUnreadMessages={unreadBookingIds.has(booking.id)} compact divided={index >= 0} />
                ))}
              </AppList>
              {laterBookings.length > 0 ? (
                <button type="button" onClick={() => setShowAllUpcoming((current) => !current)} className="mt-2 flex w-full items-center justify-center gap-2 py-2 text-xs font-semibold text-[#667085]">
                  {showAllUpcoming ? "Show fewer" : `${laterBookings.length} more scheduled`}
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAllUpcoming ? "rotate-180" : ""}`} />
                </button>
              ) : null}
            </div>
          ) : plans.length === 0 ? (
            <AppEmptyState title="Nothing scheduled" description="Book when you need another cleaning." />
          ) : null}
        </section>
      ) : (
        <section>
          {history.length === 0 ? (
            <AppEmptyState title="No history yet" description="Completed, cancelled, and closed missed visits will appear here." />
          ) : (
            <>
              <AppList>
                {visibleHistory.map((booking, index) => (
                  <BookingRow key={booking.id} booking={booking} hasUnreadMessages={unreadBookingIds.has(booking.id)} compact closedMissed={resolvedMissedIds.has(booking.id)} divided={index > 0} />
                ))}
              </AppList>
              {historyLimit < history.length ? (
                <button type="button" onClick={() => setHistoryLimit((current) => current + 10)} className="mt-2 w-full py-3 text-sm font-semibold text-[#475467]">Show more history</button>
              ) : null}
            </>
          )}
        </section>
      )}
    </div>
  );
}
