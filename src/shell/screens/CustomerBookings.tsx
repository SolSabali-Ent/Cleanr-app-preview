import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listBookingsForCustomer } from "../../lib/bookingApi";
import type { Booking } from "../../domain/booking";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useUnreadBookingMessageIds } from "../../hooks/useUnreadBookingMessageIds";
import { customerFacingServiceLabel } from "../../lib/serviceCatalog";
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

function BookingRow({
  booking,
  hasUnreadMessages,
  compact = false,
}: {
  booking: Booking;
  hasUnreadMessages: boolean;
  compact?: boolean;
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
        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusStyles[booking.status] ?? "bg-slate-100 text-slate-700"}`}>
          {toCustomerBookingStatusLabel(booking.status)}
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

type BookingTab = "upcoming" | "history";

export function CustomerBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<BookingTab>("upcoming");
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(10);
  const { unreadBookingIds } = useUnreadBookingMessageIds();

  useEffect(() => {
    listBookingsForCustomer()
      .then(setBookings)
      .catch((err) => setError(err?.message ?? "Failed to load bookings"))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = useMemo(
    () =>
      bookings
        .filter((booking) => isUpcomingBookingStatus(booking.status))
        // A zero-dollar created row is an unfinished booking attempt, not a scheduled cleaning.
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
    if (!loading && upcoming.length === 0 && history.length > 0) setTab("history");
  }, [loading, upcoming.length, history.length]);

  if (loading) {
    return <div className="p-4"><p className="text-sm text-[#667085]">Loading bookings…</p></div>;
  }

  if (error) {
    return <div className="p-4"><p className="text-sm text-red-400">{error}</p></div>;
  }

  const nextBooking = upcoming[0] ?? null;
  const laterBookings = upcoming.slice(1);
  const visibleLater = showAllUpcoming ? laterBookings : [];
  const visibleHistory = history.slice(0, historyLimit);

  return (
    <div className="text-[#0B1220]">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Bookings</h1>
        <p className="mt-1 text-xs text-[#667085]">What&apos;s next and what you&apos;ve already done.</p>
      </header>

      <div className="mb-5 grid grid-cols-2 rounded-xl bg-[#F2F4F7] p-1">
        <button
          type="button"
          onClick={() => setTab("upcoming")}
          className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${tab === "upcoming" ? "bg-white text-[#0B1220] shadow-sm" : "text-[#667085]"}`}
        >
          Upcoming {upcoming.length > 0 ? `(${upcoming.length})` : ""}
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
          {nextBooking ? (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#166534]">Next cleaning</p>
              <BookingRow booking={nextBooking} hasUnreadMessages={unreadBookingIds.has(nextBooking.id)} />

              {laterBookings.length > 0 ? (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowAllUpcoming((current) => !current)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#E4E7EC] bg-white px-4 py-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {laterBookings.length} more scheduled
                      </p>
                      <p className="mt-0.5 text-xs text-[#667085]">
                        Kept out of the way until you need them.
                      </p>
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
          ) : (
            <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
              <p className="text-sm font-semibold">Nothing scheduled right now.</p>
              <p className="mt-1 text-xs text-[#667085]">When you book again, your next cleaning will show here.</p>
            </div>
          )}
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
