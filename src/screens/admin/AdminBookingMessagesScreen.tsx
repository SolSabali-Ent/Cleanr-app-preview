import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getBookingThreadByBookingId,
  listBookingMessages,
  type BookingMessage,
  type BookingMessageThread,
} from "../../lib/messagingApi";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminSecondaryButton,
  AdminStatus,
} from "./AdminUi";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function AdminBookingMessagesScreen() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [thread, setThread] = useState<BookingMessageThread | null | undefined>(undefined);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setLoading(false);
      setError("Missing booking ID");
      return;
    }
    let mounted = true;
    setLoading(true);
    setError(null);
    getBookingThreadByBookingId(bookingId)
      .then((nextThread) => {
        if (!mounted) return [];
        setThread(nextThread ?? null);
        return nextThread ? listBookingMessages(nextThread.id) : [];
      })
      .then((list) => {
        if (mounted) setMessages(list ?? []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load conversation");
        setThread(null);
        setMessages([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [bookingId]);

  return (
    <AdminPage width="standard">
      <AdminPageHeader
        eyebrow="Booking inspection"
        title="Conversation"
        description="Read-only booking communication shown in chronological order."
        meta={bookingId ? <span className="font-mono text-xs text-slate-500">Booking {bookingId}</span> : undefined}
        actions={
          <AdminSecondaryButton onClick={() => navigate("/admin/ops")}>
            <ArrowLeft className="h-4 w-4" /> Operations
          </AdminSecondaryButton>
        }
      />

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading conversation…</div>
      ) : !bookingId ? (
        <AdminEmptyState title="Missing booking ID" />
      ) : thread === null || thread === undefined ? (
        <AdminEmptyState title="No conversation yet" description="This booking does not have a message thread." />
      ) : messages.length === 0 ? (
        <AdminEmptyState title="No messages yet" description="The thread exists, but no messages have been sent." />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
            <span className="text-xs font-semibold text-slate-600">{messages.length} message{messages.length === 1 ? "" : "s"}</span>
            <AdminStatus>Read-only</AdminStatus>
          </div>
          <div className="divide-y divide-slate-200">
            {messages.map((message) => (
              <article key={message.id} className="grid gap-3 px-5 py-4 md:grid-cols-[130px_minmax(0,1fr)_170px] md:items-start">
                <div><AdminStatus tone={message.sender_role === "customer" ? "info" : "neutral"}>{message.sender_role}</AdminStatus></div>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{message.body}</p>
                <time className="text-xs text-slate-500 md:text-right">{formatTime(message.created_at)}</time>
              </article>
            ))}
          </div>
        </section>
      )}

      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">Inspection boundary</summary>
        <p className="border-t border-slate-200 px-5 py-4 text-xs leading-5 text-slate-600">This view is for context and audit. It does not let admin speak as the customer or CSP and does not create a parallel messaging path.</p>
      </details>
    </AdminPage>
  );
}
