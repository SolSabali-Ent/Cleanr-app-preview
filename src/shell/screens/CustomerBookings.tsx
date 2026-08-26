import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listBookingsForCustomer } from "../../lib/bookingApi";
import type { Booking } from "../../domain/booking";
import { ChevronRight } from "lucide-react";
import { useUnreadBookingMessageIds } from "../../hooks/useUnreadBookingMessageIds";
import { customerFacingServiceLabel } from "../../lib/serviceCatalog";
import {
  isHistoryBookingStatus,
  isUpcomingBookingStatus,
  toCustomerBookingStatusLabel,
} from "../../lib/customerBookingStatus";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
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
}: {
  booking: Booking;
  hasUnreadMessages: boolean;
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
      onClick={() => navigate(`/app/bookings/${booking.id}`)}
      className="w-full flex items-center justify-between bg-white border border-[#E5E7EB] rounded-[14px] px-3 py-3 mb-2 text-left relative"
    >
      {hasUnreadMessages ? (
        <span
          className="absolute top-3 right-10 w-2 h-2 rounded-full bg-[#0A84FF] shrink-0"
          aria-hidden
        />
      ) : null}
      <div>
        <p className="text-sm font-semibold">{customerFacingServiceLabel(booking.service_type)}</p>
        <p className="text-xs text-[#667085] mt-0.5">
          {formatDate(booking.scheduled_start)} · {formatTime(booking.scheduled_start)}
        </p>
        <p className="text-xs text-[#667085] mt-0.5">{booking.address}</p>
        <span
          className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusStyles[booking.status] ?? "bg-slate-100 text-slate-700"}`}
        >
          {toCustomerBookingStatusLabel(booking.status)}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <p className="text-sm font-semibold">${((booking.price_cents ?? 0) / 100).toFixed(0)}</p>
        <ChevronRight className="w-4 h-4 text-[#8DCC64] mt-1 icon-right" />
      </div>
    </button>
  );
}

export function CustomerBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { unreadBookingIds } = useUnreadBookingMessageIds();

  useEffect(() => {
    listBookingsForCustomer()
      .then(setBookings)
      .catch((err) => setError(err?.message ?? "Failed to load bookings"))
      .finally(() => setLoading(false));
  }, []);

  const upcoming = bookings.filter((b) => isUpcomingBookingStatus(b.status));
  const past = bookings.filter((b) => isHistoryBookingStatus(b.status));

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-sm text-[#667085]">Loading bookings…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="text-[#0B1220]">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">My bookings</h1>
        <p className="text-xs text-[#667085] mt-1">
          See what&apos;s coming up and what you&apos;ve already completed.
        </p>
      </header>

      <section className="mb-4 section">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#166534] mb-1">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-xs text-[#667085]">
            No upcoming cleanings. Book your next visit from the Home tab.
          </p>
        ) : (
          upcoming.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              hasUnreadMessages={unreadBookingIds.has(b.id)}
            />
          ))
        )}
      </section>

      <section className="section">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#166534] mb-1">
          History
        </h2>
        {past.length === 0 ? (
          <p className="text-xs text-[#667085]">
            You haven&apos;t completed any cleanings yet.
          </p>
        ) : (
          past.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              hasUnreadMessages={unreadBookingIds.has(b.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}
