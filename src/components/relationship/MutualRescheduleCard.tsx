import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import type { Booking } from "@/domain/booking";
import type { BookingRescheduleRequest } from "@/domain/bookingReschedule";
import { getBooking } from "@/lib/bookingApi";
import {
  getPendingBookingReschedule,
  proposeBookingReschedule,
  respondToBookingReschedule,
} from "@/lib/bookingRescheduleApi";
import { isOfflinePreviewMode, supabase } from "@/lib/supabase";

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function toLocalInputMin(): string {
  const now = new Date(Date.now() + 30 * 60 * 1000);
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

function participantLabel(audience: "customer" | "provider", incoming: boolean): string {
  if (audience === "provider") return incoming ? "The household" : "the household";
  return incoming ? "Your CSP" : "your CSP";
}

export function MutualRescheduleCard({
  bookingId,
  audience,
  onScheduleChanged,
}: {
  bookingId: string;
  audience: "customer" | "provider";
  onScheduleChanged?: () => void | Promise<void>;
}) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [request, setRequest] = useState<BookingRescheduleRequest | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [proposedLocal, setProposedLocal] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    if (isOfflinePreviewMode) return;
    const [{ data: authData, error: authError }, nextBooking, nextRequest] = await Promise.all([
      supabase.auth.getUser(),
      getBooking(bookingId),
      getPendingBookingReschedule(bookingId),
    ]);
    if (authError) throw authError;
    setViewerId(authData.user?.id ?? null);
    setBooking(nextBooking);
    setRequest(nextRequest);
  }

  useEffect(() => {
    let active = true;
    if (isOfflinePreviewMode) return;
    void refresh().catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Rescheduling is temporarily unavailable.");
    });
    return () => {
      active = false;
    };
  }, [bookingId]);

  const isParticipant = useMemo(() => {
    if (!booking || !viewerId) return false;
    return booking.customer_id === viewerId || booking.provider_id === viewerId;
  }, [booking, viewerId]);

  const isRequester = Boolean(request && viewerId && request.requestedBy === viewerId);
  const incoming = Boolean(request && !isRequester);
  const otherParty = participantLabel(audience, incoming);
  const canReschedule =
    Boolean(booking?.provider_id) &&
    booking?.status === "accepted" &&
    new Date(booking.scheduled_start).getTime() > Date.now();

  async function submitProposal() {
    if (!proposedLocal || busy) return;
    const proposedDate = new Date(proposedLocal);
    if (!Number.isFinite(proposedDate.getTime()) || proposedDate.getTime() <= Date.now()) {
      setError("Choose a future date and time.");
      return;
    }

    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      const created = await proposeBookingReschedule({
        bookingId,
        proposedStart: proposedDate.toISOString(),
        note,
      });
      setRequest(created);
      setFormOpen(false);
      setProposedLocal("");
      setNote("");
      setNotice(`Sent to ${otherParty} for approval. The current appointment has not changed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the new time.");
    } finally {
      setBusy(false);
    }
  }

  async function respond(response: "accept" | "decline" | "cancel") {
    if (!request || busy) return;
    try {
      setBusy(true);
      setError(null);
      setNotice(null);
      await respondToBookingReschedule(request.id, response);
      setRequest(null);

      if (response === "accept") {
        const refreshed = await getBooking(bookingId);
        setBooking(refreshed);
        setNotice("New time confirmed. This visit moved; the recurring cadence did not change.");
        await onScheduleChanged?.();
      } else if (response === "decline") {
        setNotice("That time was declined. The current appointment is still in place, and either of you can suggest another time.");
      } else {
        setNotice("Reschedule request cancelled. The current appointment is still in place.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the reschedule request.");
      await refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  if (isOfflinePreviewMode || !isParticipant || !canReschedule) return null;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md text-slate-900">
      <div className="flex items-start gap-3">
        <CalendarClock className="h-5 w-5 text-[#8DCC64] mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-500">Reschedule together</p>
          <p className="mt-1 text-sm font-semibold">Life changes. The appointment only moves when both sides agree.</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Either the household or CSP can suggest another time. Cleanr keeps the current visit in place until the other person accepts.
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Current visit</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(booking.scheduled_start)}</p>
      </div>

      {error ? <p className="mt-3 text-xs text-red-600" role="alert">{error}</p> : null}
      {notice ? <p className="mt-3 text-xs leading-5 text-emerald-700">{notice}</p> : null}

      {request ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                {isRequester ? "Waiting for approval" : "New time suggested"}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(request.proposedStart)}</p>
              {request.note ? <p className="mt-2 text-xs leading-5 text-slate-600">{request.note}</p> : null}
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-blue-700">Pending</span>
          </div>

          {isRequester ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void respond("cancel")}
              className="mt-3 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
            >
              Cancel request
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void respond("accept")}
                className="w-full rounded-xl bg-[#8DCC64] px-3 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
              >
                Accept new time
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void respond("decline")}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
                >
                  Keep current time
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setFormOpen(true);
                    setNotice("Suggesting a different time will replace the pending suggestion, but the booked appointment stays unchanged until accepted.");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50"
                >
                  Suggest another
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {!request && !formOpen ? (
        <button
          type="button"
          onClick={() => {
            setFormOpen(true);
            setNotice(null);
          }}
          className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900"
        >
          Suggest another time
        </button>
      ) : null}

      {formOpen ? (
        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Suggested date & time</span>
            <input
              type="datetime-local"
              min={toLocalInputMin()}
              value={proposedLocal}
              onChange={(event) => setProposedLocal(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Optional note</span>
            <textarea
              value={note}
              maxLength={500}
              rows={2}
              onChange={(event) => setNote(event.target.value)}
              placeholder={audience === "provider" ? "Only what the household needs to understand the change." : "Only what your CSP needs to understand the change."}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setProposedLocal("");
                setNote("");
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800"
            >
              Never mind
            </button>
            <button
              type="button"
              disabled={!proposedLocal || busy}
              onClick={() => void submitProposal()}
              className="rounded-xl bg-[#8DCC64] px-3 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-50"
            >
              {busy ? "Sending..." : "Send suggestion"}
            </button>
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-4 text-slate-500">
        This changes one visit only. Recurring cadence stays intact unless both sides explicitly change the recurring plan later. If timing cannot be resolved, trusted coverage remains a separate continuity option.
      </p>
    </section>
  );
}
