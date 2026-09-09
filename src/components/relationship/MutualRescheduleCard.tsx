import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import type { Booking } from "@/domain/booking";
import type { BookingRescheduleRequest } from "@/domain/bookingReschedule";
import { getBooking } from "@/lib/bookingApi";
import { isMissedAcceptedVisit } from "@/lib/bookingServiceDay";
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
  embedded = false,
}: {
  bookingId: string;
  audience: "customer" | "provider";
  onScheduleChanged?: () => void | Promise<void>;
  embedded?: boolean;
}) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [request, setRequest] = useState<BookingRescheduleRequest | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [missedSchedulingClosed, setMissedSchedulingClosed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [proposedLocal, setProposedLocal] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    if (isOfflinePreviewMode) return;
    const [{ data: authData, error: authError }, nextBooking, nextRequest, resolutionResult] = await Promise.all([
      supabase.auth.getUser(),
      getBooking(bookingId),
      getPendingBookingReschedule(bookingId),
      supabase.from("bookings").select("missed_visit_resolution").eq("id", bookingId).maybeSingle(),
    ]);
    if (authError) throw authError;
    setViewerId(authData.user?.id ?? null);
    setBooking(nextBooking);
    setRequest(nextRequest);
    setMissedSchedulingClosed(Boolean(resolutionResult.data?.missed_visit_resolution));
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
  const canReschedule = Boolean(booking?.provider_id) && booking?.status === "accepted" && !missedSchedulingClosed;
  const missedVisit = Boolean(booking && isMissedAcceptedVisit(booking));

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
      setNotice(`Sent to ${otherParty}. The visit moves only after approval.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not send the new time.";
      if (message.includes("missed_visit_scheduling_closed")) {
        setMissedSchedulingClosed(true);
        setError(null);
        setNotice("This missed visit was closed without a make-up appointment.");
      } else {
        setError(message);
      }
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
        setNotice("New time confirmed. Your recurring cadence did not change.");
        await onScheduleChanged?.();
      } else if (response === "decline") {
        setNotice("That time was declined. The current visit time has not changed.");
      } else {
        setNotice("Request cancelled. The current visit time has not changed.");
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
    <section className={embedded ? "text-slate-900" : "mb-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-md"}>
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-[#8DCC64]" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{missedVisit ? "Choose a new time" : "Reschedule visit"}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Suggest another time. The visit changes only after {audience === "provider" ? "the household" : "your CSP"} accepts.
          </p>
        </div>
      </div>

      <div className={`mt-3 border-y py-3 ${missedVisit ? "border-amber-200" : "border-slate-200"}`}>
        <p className={`text-[10px] font-semibold uppercase tracking-wide ${missedVisit ? "text-amber-700" : "text-slate-500"}`}>{missedVisit ? "Missed scheduled time" : "Current time"}</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(booking.scheduled_start)}</p>
      </div>

      {error ? <p className="mt-3 text-xs text-red-600" role="alert">{error}</p> : null}
      {notice ? <p className="mt-3 text-xs leading-5 text-emerald-700">{notice}</p> : null}

      {request ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                {isRequester ? "Waiting for approval" : "New time suggested"}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(request.proposedStart)}</p>
              {request.note ? <p className="mt-2 text-xs leading-5 text-slate-600">{request.note}</p> : null}
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-blue-700">Pending</span>
          </div>

          {isRequester ? (
            <button type="button" disabled={busy} onClick={() => void respond("cancel")} className="mt-3 w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50">Cancel request</button>
          ) : (
            <div className="mt-3 space-y-2">
              <button type="button" disabled={busy} onClick={() => void respond("accept")} className="w-full rounded-xl bg-[#8DCC64] px-3 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-50">Accept new time</button>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={busy} onClick={() => void respond("decline")} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50">Decline</button>
                <button type="button" disabled={busy} onClick={() => { setFormOpen(true); setNotice("Suggesting another time replaces the pending suggestion."); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 disabled:opacity-50">Suggest another</button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {!request && !formOpen ? (
        <button type="button" onClick={() => { setFormOpen(true); setNotice(null); }} className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900">Suggest another time</button>
      ) : null}

      {formOpen ? (
        <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">New date & time</span>
            <input type="datetime-local" min={toLocalInputMin()} value={proposedLocal} onChange={(event) => setProposedLocal(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Note (optional)</span>
            <textarea value={note} maxLength={500} rows={2} onChange={(event) => setNote(event.target.value)} placeholder="Add context if it helps" className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setFormOpen(false); setProposedLocal(""); setNote(""); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800">Never mind</button>
            <button type="button" disabled={!proposedLocal || busy} onClick={() => void submitProposal()} className="rounded-xl bg-[#8DCC64] px-3 py-2.5 text-xs font-semibold text-slate-950 disabled:opacity-50">{busy ? "Sending..." : "Send suggestion"}</button>
          </div>
        </div>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer list-none text-[11px] text-slate-500">Recurring cleaning</summary>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">This changes one visit only. Your recurring cadence stays the same.</p>
      </details>
    </section>
  );
}
