import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getBookingThreadByBookingId,
  listBookingMessages,
  type BookingMessage,
  type BookingMessageThread,
} from "../../lib/messagingApi";
import { adminTheme } from "../../theme/adminTheme";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
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
      .then((t) => {
        if (!mounted) return;
        setThread(t ?? null);
        if (!t) return [];
        return listBookingMessages(t.id);
      })
      .then((list) => {
        if (!mounted) return;
        setMessages(list ?? []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message ?? "Failed to load conversation");
        setThread(null);
        setMessages([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [bookingId]);

  if (!bookingId) {
    return (
      <div style={{ color: adminTheme.textPrimary }}>
        <button
          type="button"
          onClick={() => navigate("/admin/ops")}
          className="text-sm underline"
          style={{ color: adminTheme.primary }}
        >
          ← Back to Operations
        </button>
        <p className="mt-2 text-sm" style={{ color: adminTheme.textSecondary }}>
          Missing booking ID.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ color: adminTheme.textPrimary }}>
        <button
          type="button"
          onClick={() => navigate("/admin/ops")}
          className="text-sm underline"
          style={{ color: adminTheme.primary }}
        >
          ← Back to Operations
        </button>
        <p className="mt-4 text-sm" style={{ color: adminTheme.textSecondary }}>
          Loading conversation…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ color: adminTheme.textPrimary }}>
        <button
          type="button"
          onClick={() => navigate("/admin/ops")}
          className="text-sm underline"
          style={{ color: adminTheme.primary }}
        >
          ← Back to Operations
        </button>
        <p className="mt-2 text-sm" style={{ color: adminTheme.danger }}>
          {error}
        </p>
      </div>
    );
  }

  if (thread === null || thread === undefined) {
    return (
      <div style={{ color: adminTheme.textPrimary }}>
        <button
          type="button"
          onClick={() => navigate("/admin/ops")}
          className="text-sm underline"
          style={{ color: adminTheme.primary }}
        >
          ← Back to Operations
        </button>
        <h1 className="mt-4 text-xl font-semibold">Booking conversation</h1>
        <p className="mt-2 text-sm" style={{ color: adminTheme.textSecondary }}>
          Booking: {bookingId}
        </p>
        <p className="mt-4 text-sm" style={{ color: adminTheme.textSecondary }}>
          No conversation yet for this booking.
        </p>
      </div>
    );
  }

  return (
    <div style={{ color: adminTheme.textPrimary }}>
      <button
        type="button"
        onClick={() => navigate("/admin/ops")}
        className="text-sm underline"
        style={{ color: adminTheme.primary }}
      >
        ← Back to Operations
      </button>
      <h1 className="mt-4 text-xl font-semibold">Booking conversation</h1>
      <p className="mt-1 text-sm" style={{ color: adminTheme.textSecondary }}>
        Booking: {bookingId} · Read-only
      </p>

      <div
        className="mt-4 space-y-3 rounded-xl border p-4"
        style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}
      >
        {messages.length === 0 ? (
          <p className="text-sm" style={{ color: adminTheme.textSecondary }}>
            No messages in this thread yet.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border p-3"
              style={{
                borderColor: adminTheme.border,
                backgroundColor: adminTheme.surface,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-xs font-medium capitalize"
                  style={{ color: adminTheme.primary }}
                >
                  {m.sender_role}
                </span>
                <span className="text-xs" style={{ color: adminTheme.textSecondary }}>
                  {formatTime(m.created_at)}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                {m.body}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
