import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { adminTheme } from "../../theme/adminTheme";

type PendingBookingRow = {
  id: string;
  status: string;
  provider_id: string | null;
  service_relationship_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
};

type OutboxRow = {
  id: string;
  event_type: string;
  booking_id: string | null;
  status: string;
  attempt_count: number | null;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  sent_at: string | null;
};

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function KinexHandoffPanel() {
  const [bookings, setBookings] = useState<PendingBookingRow[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const [bookingResult, outboxResult] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,status,provider_id,service_relationship_id,stripe_payment_intent_id,created_at,updated_at")
        .not("service_relationship_id", "is", null)
        .not("stripe_payment_intent_id", "is", null)
        .is("provider_id", null)
        .eq("status", "created")
        .order("updated_at", { ascending: true })
        .limit(50),
      supabase
        .from("kinex_event_outbox")
        .select("id,event_type,booking_id,status,attempt_count,last_error,next_retry_at,created_at,sent_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const errors: string[] = [];
    if (bookingResult.error) errors.push(`relationship assignments: ${bookingResult.error.message}`);
    else setBookings((bookingResult.data ?? []) as PendingBookingRow[]);

    if (outboxResult.error) errors.push(`Kinex outbox: ${outboxResult.error.message}`);
    else setOutbox((outboxResult.data ?? []) as OutboxRow[]);

    setError(errors.length ? errors.join(" · ") : null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const health = useMemo(() => {
    const queued = outbox.filter((row) => row.status === "queued").length;
    const processing = outbox.filter((row) => row.status === "processing").length;
    const failed = outbox.filter((row) => row.status === "failed").length;
    const sent = outbox.filter((row) => row.status === "sent").length;
    const bookingConfirmed = outbox.filter((row) => row.event_type === "booking_confirmed");
    const failedConfirmed = bookingConfirmed.filter((row) => row.status === "failed").length;
    return { queued, processing, failed, sent, failedConfirmed };
  }, [outbox]);

  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: adminTheme.textPrimary }}>
            Kinex handoff attention
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-5" style={{ color: adminTheme.textSecondary }}>
            Read-only operational truth. Cleanr records payment and relationship context; Kinex owns orchestration; Cleanr only persists a provider after trusted reconciliation. This panel does not provide a manual assignment bypass.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
          style={{ borderColor: adminTheme.border, color: adminTheme.textPrimary }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Pending relationship assignment", bookings.length, "Paid relationship bookings still waiting for formal provider reconciliation"],
          ["Outbox queued", health.queued, "Cleanr events waiting to be delivered to Kinex"],
          ["Outbox processing", health.processing, "Rows currently claimed by the transport worker"],
          ["Outbox failed", health.failed, `${health.failedConfirmed} failed booking_confirmed events`],
          ["Outbox sent", health.sent, "Recent transport rows successfully handed to Kinex"],
        ].map(([label, value, detail]) => (
          <div key={String(label)} className="rounded-xl border p-3" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}>
            <p className="text-[11px] font-medium" style={{ color: adminTheme.textSecondary }}>{label}</p>
            <p className="mt-1 text-xl font-semibold" style={{ color: adminTheme.textPrimary }}>{value}</p>
            <p className="mt-1 text-[11px] leading-4" style={{ color: adminTheme.textSecondary }}>{detail}</p>
          </div>
        ))}
      </div>

      {bookings.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead style={{ color: adminTheme.textSecondary }}>
              <tr>
                <th className="py-2">Booking</th>
                <th>Relationship</th>
                <th>Waiting since</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-t border-slate-200">
                  <td className="py-2 font-mono text-[11px]">{booking.id}</td>
                  <td className="font-mono text-[11px]">{booking.service_relationship_id ?? "—"}</td>
                  <td>{formatTimestamp(booking.updated_at || booking.created_at)}</td>
                  <td>
                    <Link
                      to={`/admin/full-app/customer/bookings/${booking.id}`}
                      className="font-semibold underline"
                      style={{ color: adminTheme.primary }}
                    >
                      customer view
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-xs" style={{ color: adminTheme.textSecondary }}>
          No paid relationship booking is currently waiting for provider reconciliation.
        </p>
      )}

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-800">Blocked Kinex database activation</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">
          The Kinex source migration for the Cleanr relationship-assignment routing rule is ready, but live Kinex database access is not currently available. Until that migration is confirmed live, this panel intentionally exposes no retry or manual assignment control.
        </p>
      </div>
    </section>
  );
}
