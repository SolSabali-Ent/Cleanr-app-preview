import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  getOrCreateBookingThread,
  listBookingMessages,
  sendBookingMessage,
  markBookingMessageNotificationsRead,
  MAX_MESSAGE_LENGTH,
  type BookingMessage,
  type BookingMessageThread,
} from "../../lib/messagingApi";
import { Button } from "../../components/ui/Button";

type Variant = "customer" | "csp";

type BookingMessageScreenProps = {
  variant: Variant;
  backPath: string;
  backLabel?: string;
  title?: string;
  /** Customer theme: light. CSP: dark. */
  theme?: "light" | "dark";
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function BookingMessageScreen({
  variant,
  backPath,
  backLabel = "Back",
  title = "Message",
  theme = "light",
}: BookingMessageScreenProps) {
  const params = useParams<{ bookingId?: string; jobId?: string }>();
  const id = params.bookingId ?? params.jobId;
  const navigate = useNavigate();
  const [thread, setThread] = useState<BookingMessageThread | null>(null);
  const [messages, setMessages] = useState<BookingMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const isDark = theme === "dark";

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let mounted = true;
    getOrCreateBookingThread(id)
      .then((t) => {
        if (!mounted) return;
        setThread(t);
        markBookingMessageNotificationsRead(t.id).catch(() => {});
        return listBookingMessages(t.id);
      })
      .then((list) => {
        if (!mounted) return;
        setMessages(list ?? []);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err?.message ?? "Could not load thread");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!thread?.id) return;
    const channel = supabase
      .channel(`booking_messages:${thread.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "booking_messages",
          filter: `thread_id=eq.${thread.id}`,
        },
        () => {
          listBookingMessages(thread.id).then(setMessages);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [thread?.id]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!thread || !trimmed || sending) return;
    if (trimmed.length > MAX_MESSAGE_LENGTH) return;
    setSending(true);
    setError(null);
    setBody("");
    try {
      await sendBookingMessage(thread.id, trimmed);
      const list = await listBookingMessages(thread.id);
      setMessages(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
      setBody(trimmed);
    } finally {
      setSending(false);
    }
  };

  const trimmedLength = body.trim().length;
  const atOrOverLimit = trimmedLength >= MAX_MESSAGE_LENGTH;
  const canSend = thread && trimmedLength > 0 && trimmedLength <= MAX_MESSAGE_LENGTH && !sending;

  if (!id) {
    return (
      <div className={isDark ? "text-white p-4" : "text-[#0B1220] p-4"}>
        <button type="button" onClick={() => navigate(backPath)} className="text-sm underline">
          {backLabel}
        </button>
        <p className="mt-2 text-sm opacity-80">Booking not found.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={isDark ? "text-white p-4" : "text-[#0B1220] p-4"}>
        <button type="button" onClick={() => navigate(backPath)} className="text-sm underline">
          {backLabel}
        </button>
        <p className="mt-4 text-sm opacity-80">Loading…</p>
      </div>
    );
  }

  if (error && !thread) {
    return (
      <div className={isDark ? "text-white p-4" : "text-[#0B1220] p-4"}>
        <button type="button" onClick={() => navigate(backPath)} className="text-sm underline">
          {backLabel}
        </button>
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      </div>
    );
  }

  const myRole = variant;
  const isMe = (m: BookingMessage) => m.sender_role === myRole;

  return (
    <div
      className="flex flex-col h-full min-h-[60vh]"
      style={{
        backgroundColor: isDark ? "#0f172a" : "#F8F9FC",
        color: isDark ? "#f8fafc" : "#0B1220",
      }}
    >
      <header className="shrink-0 flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: isDark ? "rgba(248,250,252,0.1)" : "#E5E7EB" }}>
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className="text-sm font-medium opacity-90 hover:opacity-100"
        >
          ← {backLabel}
        </button>
        <h1 className="text-lg font-semibold flex-1 truncate">{title}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <p className="text-sm opacity-70">No messages yet. Say hello.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${isMe(m) ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[85%] rounded-2xl px-4 py-2 text-sm"
                style={{
                  backgroundColor: isMe(m)
                    ? isDark
                      ? "#1e3a5f"
                      : "#0A84FF"
                    : isDark
                      ? "rgba(248,250,252,0.08)"
                      : "#FFFFFF",
                  color: isDark ? "#f8fafc" : isMe(m) ? "#fff" : "#0B1220",
                  border: isDark && !isMe(m) ? "1px solid rgba(248,250,252,0.12)" : undefined,
                }}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className="text-[10px] mt-1 opacity-70">{formatTime(m.created_at)}</p>
              </div>
            </div>
          ))
        )}
        <div ref={listEndRef} />
      </div>

      {error ? (
        <p className="shrink-0 px-4 py-1 text-sm text-red-500" role="alert">
          {error}
        </p>
      ) : null}

      <div
        className="shrink-0 flex flex-col gap-1 p-4 border-t"
        style={{ borderColor: isDark ? "rgba(248,250,252,0.1)" : "#E5E7EB" }}
      >
        {trimmedLength > MAX_MESSAGE_LENGTH * 0.9 ? (
          <p className={`text-xs ${atOrOverLimit ? "text-red-500" : "opacity-70"}`}>
            {trimmedLength}/{MAX_MESSAGE_LENGTH}
          </p>
        ) : null}
        <div className="flex gap-2">
          <input
            type="text"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) handleSend();
              }
            }}
            placeholder="Type a message…"
            maxLength={MAX_MESSAGE_LENGTH}
            className="flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A84FF]"
            style={{
              backgroundColor: isDark ? "rgba(30,41,59,0.8)" : "#fff",
              borderColor: isDark ? "rgba(248,250,252,0.12)" : "#E5E7EB",
              color: isDark ? "#f8fafc" : "#0B1220",
            }}
          />
          <Button
            type="button"
            variant="primaryBlue"
            size="md"
            disabled={!canSend}
            onClick={handleSend}
          >
            {sending ? "…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
