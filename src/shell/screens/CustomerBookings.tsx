import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listBookingsForCustomer } from "../../lib/bookingApi";
import {
  listMyRecurringCleaningPlans,
  resolveMyMissedVisitWithoutReschedule,
  updateMyRecurringCleaningPlan,
  type RecurringCleaningPlan,
} from "../../lib/recurringCleaningApi";
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

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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

function BookingRow({
  booking,
  hasUnreadMessages,
  compact = false,
  forceNeedsRescheduling = false,
}: {
  booking: Booking;
  hasUnreadMessages: boolean;
  compact?: boolean;
  forceNeedsRescheduling?: boolean;
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

  return (
    <button
      type="button"
      onClick={() => navigate(`/app/bookings/${booking.id}`)}
      className={`relative mb-2 flex w-full items-center justify-between rounded-[14px] border border-[#E5E7EB] bg-white text-left ${compact ? "px-3 py-3" : "px-4 py-4"}`}
    >
      {hasUnreadMessages ? (
        <span className="absolute right-10 top-3 h-2 w-2 rounded-full bg-[#0A84FF]" aria-hidden />
      ) : null}

      <div className="min-w-0 pr-3">
        <p className="text-sm font-semibold">{customerFacingServiceLabel(booking.service_type)}</p>
        <p className="mt-0.5 text-xs text-[#667085]">
          {formatDate(booking.scheduled_start)} · {formatTime(booking.scheduled_start)}
        </p>
        {!compact ? <p className="mt-0.5 truncate text-xs text-[#667085]">{booking.address}</p> : null}
        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${forceNeedsRescheduling ? "bg-amber-100 text-amber-800" : statusStyles[booking.status] ?? "bg-slate-100 text-slate-700"}`}>
          {forceNeedsRescheduling ? "Needs rescheduling" : toCustomerBookingStatusLabel(booking.status)}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {booking.price_cents > 0 ? (
          <p className="text-sm font-semibold">${(booking.price_cents / 100).toFixed(0)}</p>
        ) : null}
        <ChevronRight className="h-4 w-4 text-[#8DCC64]" />
      </div>
    </button>
  );
}

function RecurringPlanCard({
  plan,
  currentBooking,
  busy,
  resolutionBusy,
  onUpdate,
  onResolveMissed,
}: {
  plan: RecurringCleaningPlan;
  currentBooking: Booking | null;
  busy: boolean;
  resolutionBusy: boolean;
  onUpdate: (planId: string, action: "pause" | "resume" | "end") => Promise<void>;
  onResolveMissed: (bookingId: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const cleanerName = firstName(plan.preferredProviderName);
  const paused = plan.status === "paused";
  const missedCurrentVisit = Boolean(currentBooking && isMissedAcceptedVisit(currentBooking));

  return (
    <div className="mb-3 rounded-2xl border border-[#CFE8C3] bg-[#F7FBF4] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#8DCC64]/15 text-[#166534]">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Your recurring cleaning</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${paused ? "bg-[#F2F4F7] text-[#667085]" : "bg-emerald-100 text-emerald-700"}`}>
              {paused ? "Paused" : "Active"}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#475467]">{cadenceLabel(plan.cadence)}</p>
          {cleanerName ? <p className="mt-0.5 text-xs text-[#667085]">With {cleanerName}</p> : null}
        </div>
      </div>

      <div className={`mt-4 rounded-xl px-3 py-3 ${missedCurrentVisit ? "border border-amber-200 bg-amber-50" : "bg-white/80"}`}>
        <p className={`text-[11px] font-medium uppercase tracking-wide ${missedCurrentVisit ? "text-amber-700" : "text-[#667085]"}`}>
          {missedCurrentVisit ? "Schedule needs attention" : plan.currentBookingId ? "Next visit" : paused ? "Next visit after you resume" : "Next visit"}
        </p>
        <p className="mt-1 text-sm font-semibold">
          {formatDate(missedCurrentVisit && currentBooking ? currentBooking.scheduled_start : plan.nextExpectedAt)} · {formatTime(missedCurrentVisit && currentBooking ? currentBooking.scheduled_start : plan.nextExpectedAt)}
        </p>
        {missedCurrentVisit ? <p className="mt-1 text-xs text-amber-800">This scheduled date passed without service starting. Choose a new time with your CSP or skip this occurrence.</p> : null}
      </div>

      {plan.currentBookingId ? (
        <button
          type="button"
          onClick={() => navigate(`/app/bookings/${plan.currentBookingId}`)}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-[#D0D5DD] bg-white px-3 py-3 text-left"
        >
          <div>
            <p className="text-sm font-semibold">{missedCurrentVisit ? "Reschedule this visit" : "View or change next visit"}</p>
            <p className="mt-0.5 text-xs text-[#667085]">{missedCurrentVisit ? "Suggest a new future time from the visit details." : "Reschedule from the visit details."}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-[#667085]" />
        </button>
      ) : null}

      {missedCurrentVisit && currentBooking ? (
        <button
          type="button"
          disabled={resolutionBusy}
          onClick={() => {
            if (window.confirm("Skip this missed visit and keep your recurring cleaning active? This will not mark the visit completed or automatically change payment/refund status.")) {
              void onResolveMissed(currentBooking.id);
            }
          }}
          className="mt-2 w-full rounded-xl px-3 py-2.5 text-xs font-semibold text-[#667085] disabled:opacity-50"
        >
          {resolutionBusy ? "Updating…" : "Don’t reschedule this visit"}
        </button>
      ) : null}

      <details className="mt-3">
        <summary className="flex cursor-pointer list-none items-center justify-center gap-2 py-2 text-xs font-semibold text-[#475467] [&::-webkit-details-marker]:hidden">
          <Settings2 className="h-4 w-4" /> Manage recurring cleaning
        </summary>
        <div className="mt-2 grid gap-2 border-t border-[#E4E7EC] pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onUpdate(plan.id, paused ? "resume" : "pause")}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "Resume recurring cleaning" : "Pause recurring cleaning"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("End this recurring cleaning? Your existing scheduled visit will not be canceled automatically.")) {
                void onUpdate(plan.id, "end");
              }
            }}
            className="min-h-[44px] rounded-xl px-3 py-2 text-sm font-medium text-[#B42318] disabled:opacity-50"
          >
            End recurring cleaning
          </button>
          <p className="text-center text-[10px] leading-4 text-[#98A2B3]">
            Pausing or ending the plan does not cancel a visit that is already scheduled.
          </p>
        </div>
      </details>
    </div>
  );
}

type BookingTab = "upcoming" | "history";

export function CustomerBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [plans, setPlans] = useState<RecurringCleaningPlan[]>([]);
  const [resolvedMissedIds, setResolvedMissedIds] = useState<Set<string>>(new Set());
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
    const resolvedQuery = supabase
      .from("bookings")
      .select("id")
      .eq("missed_visit_resolution", "not_rescheduling");

    Promise.all([listBookingsForCustomer(), listMyRecurringCleaningPlans(), resolvedQuery])
      .then(([bookingRows, planRows, resolvedResult]) => {
        setBookings(bookingRows);
        setPlans(planRows);
        setResolvedMissedIds(new Set((resolvedResult.data ?? []).map((row) => String(row.id))));
      })
      .catch((err) => setError(err?.message ?? "Failed to load bookings"))
      .finally(() => setLoading(false));
  }, []);

  const missed = useMemo(
    () => bookings
      .filter((booking) => isMissedAcceptedVisit(booking) && !resolvedMissedIds.has(booking.id))
      .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()),
    [bookings, resolvedMissedIds]
  );

  const upcoming = useMemo(
    () =>
      bookings
        .filter((booking) => isUpcomingBookingStatus(booking.status))
        .filter((booking) => !isMissedAcceptedVisit(booking))
        .filter((booking) => !(booking.status === "created" && (booking.price_cents ?? 0) <= 0))
        .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()),
    [bookings]
  );

  const history = useMemo(
    () =>
      bookings
        .filter((booking) => isHistoryBookingStatus(booking.status))
        .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()),
    [bookings]
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
      setPlans((current) =>
        action === "end"
          ? current.filter((plan) => plan.id !== planId)
          : current.map((plan) => (plan.id === planId ? updated : plan))
      );
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
      setResolvedMissedIds((current) => new Set([...current, bookingId]));
      if (result.recurringPlanId) {
        setPlans((current) => current.map((plan) =>
          plan.id === result.recurringPlanId
            ? {
                ...plan,
                currentBookingId: null,
                nextExpectedAt: result.nextExpectedAt ?? plan.nextExpectedAt,
              }
            : plan
        ));
      }
      setResolutionNotice(
        result.paymentReviewRequired
          ? "This visit will not be rescheduled. Your recurring cleaning stays active. Payment for the missed visit remains separate for Cleanr review."
          : "This visit will not be rescheduled. Your recurring cleaning stays active and continues on its normal cadence."
      );
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : "Could not close this missed visit.");
    } finally {
      setResolutionBusyId(null);
    }
  }

  if (loading) {
    return <div className="p-4"><p className="text-sm text-[#667085]">Loading bookings…</p></div>;
  }

  if (error) {
    return <div className="p-4"><p className="text-sm text-red-400">{error}</p></div>;
  }

  const bookingById = new Map(bookings.map((booking) => [booking.id, booking] as const));
  const recurringBookingIds = new Set(plans.flatMap((plan) => (plan.currentBookingId ? [plan.currentBookingId] : [])));
  const standaloneUpcoming = upcoming.filter((booking) => !recurringBookingIds.has(booking.id));
  const standaloneMissed = missed.filter((booking) => !recurringBookingIds.has(booking.id));
  const nextBooking = standaloneUpcoming[0] ?? null;
  const laterBookings = standaloneUpcoming.slice(1);
  const visibleLater = showAllUpcoming ? laterBookings : [];
  const visibleHistory = history.slice(0, historyLimit);
  const visiblePlans = showAllPlans ? plans : plans.slice(0, 1);

  return (
    <div className="text-[#0B1220]">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Bookings</h1>
        <p className="mt-1 text-xs text-[#667085]">What&apos;s next and what you&apos;ve already done.</p>
      </header>

      {resolutionNotice ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs leading-5 text-emerald-800">
          {resolutionNotice}
        </div>
      ) : null}

      {standaloneMissed.length > 0 ? (
        <section className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Schedule needs attention</p>
          <p className="mt-1 text-sm font-semibold text-amber-950">{standaloneMissed.length} visit{standaloneMissed.length === 1 ? "" : "s"} need a decision.</p>
          <p className="mt-1 text-xs leading-5 text-amber-800">The scheduled date passed without service starting. Reschedule it or close the occurrence if you do not want a make-up visit.</p>
          <div className="mt-3 space-y-3">
            {standaloneMissed.map((booking) => (
              <div key={booking.id}>
                <BookingRow booking={booking} hasUnreadMessages={unreadBookingIds.has(booking.id)} compact forceNeedsRescheduling />
                <button
                  type="button"
                  disabled={resolutionBusyId === booking.id}
                  onClick={() => {
                    if (window.confirm("Don’t reschedule this missed visit? This will close the scheduling warning without marking the visit completed or automatically changing payment/refund status.")) {
                      void handleResolveMissed(booking.id);
                    }
                  }}
                  className="w-full rounded-xl px-3 py-2 text-xs font-semibold text-amber-800 disabled:opacity-50"
                >
                  {resolutionBusyId === booking.id ? "Updating…" : "Don’t reschedule this visit"}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mb-5 grid grid-cols-2 rounded-xl bg-[#F2F4F7] p-1">
        <button
          type="button"
          onClick={() => setTab("upcoming")}
          className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === "upcoming" ? "bg-white text-[#0B1220] shadow-sm" : "text-[#667085]"}`}
        >
          Upcoming
        </button>
        <button
          type="button"
          onClick={() => setTab("history")}
          className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === "history" ? "bg-white text-[#0B1220] shadow-sm" : "text-[#667085]"}`}
        >
          History {history.length > 0 ? `(${history.length})` : ""}
        </button>
      </div>

      {tab === "upcoming" ? (
        <section className="section">
          {plans.length > 0 ? (
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#166534]">Recurring cleaning</p>
              {visiblePlans.map((plan) => (
                <RecurringPlanCard
                  key={plan.id}
                  plan={plan}
                  currentBooking={plan.currentBookingId ? bookingById.get(plan.currentBookingId) ?? null : null}
                  busy={planBusyId === plan.id}
                  resolutionBusy={Boolean(plan.currentBookingId && resolutionBusyId === plan.currentBookingId)}
                  onUpdate={handlePlanUpdate}
                  onResolveMissed={handleResolveMissed}
                />
              ))}
              {plans.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setShowAllPlans((current) => !current)}
                  className="flex w-full items-center justify-center gap-2 py-2 text-xs font-semibold text-[#667085]"
                >
                  {showAllPlans ? "Show less" : `${plans.length - 1} more recurring cleaning${plans.length - 1 === 1 ? "" : "s"}`}
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAllPlans ? "rotate-180" : ""}`} />
                </button>
              ) : null}
              {planError ? <p className="mt-2 text-xs text-[#B42318]">{planError}</p> : null}
            </div>
          ) : null}

          {nextBooking ? (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#166534]">Next one-time cleaning</p>
              <BookingRow booking={nextBooking} hasUnreadMessages={unreadBookingIds.has(nextBooking.id)} />

              {laterBookings.length > 0 ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowAllUpcoming((current) => !current)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#E4E7EC] bg-white px-4 py-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold">{laterBookings.length} more scheduled</p>
                      <p className="mt-0.5 text-xs text-[#667085]">Kept out of the way until you need them.</p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-[#667085] transition-transform ${showAllUpcoming ? "rotate-180" : ""}`} />
                  </button>

                  {visibleLater.length > 0 ? (
                    <div className="mt-3">
                      {visibleLater.map((booking) => (
                        <BookingRow
                          key={booking.id}
                          booking={booking}
                          hasUnreadMessages={unreadBookingIds.has(booking.id)}
                          compact
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : plans.length === 0 ? (
            <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
              <p className="text-sm font-semibold">Nothing scheduled right now.</p>
              <p className="mt-1 text-xs text-[#667085]">When you book again, your next cleaning will show here.</p>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="section">
          {history.length === 0 ? (
            <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
              <p className="text-sm font-semibold">No cleaning history yet.</p>
              <p className="mt-1 text-xs text-[#667085]">Completed visits will collect here over time.</p>
            </div>
          ) : (
            <>
              {visibleHistory.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  hasUnreadMessages={unreadBookingIds.has(booking.id)}
                  compact
                />
              ))}
              {historyLimit < history.length ? (
                <button
                  type="button"
                  onClick={() => setHistoryLimit((current) => current + 10)}
                  className="mt-2 w-full rounded-xl border border-[#E4E7EC] bg-white px-4 py-3 text-sm font-semibold"
                >
                  Show more history
                </button>
              ) : null}
            </>
          )}
        </section>
      )}
    </div>
  );
}
