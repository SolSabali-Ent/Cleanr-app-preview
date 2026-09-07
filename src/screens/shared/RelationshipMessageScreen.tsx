import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { MAX_MESSAGE_LENGTH } from "../../lib/messagingApi";
import {
  getOrCreateRelationshipThread,
  listRelationshipMessages,
  markRelationshipMessageNotificationsRead,
  sendRelationshipMessage,
  type RelationshipMessage,
  type RelationshipMessageThread,
} from "../../lib/relationshipMessagingApi";

type Props = {
  variant: "customer" | "csp";
  theme?: "light" | "dark";
  backPath: string;
  title?: string;
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function RelationshipMessageScreen({ variant, theme = "light", backPath, title = "Relationship messages" }: Props) {
  const { relationshipId } = useParams<{ relationshipId: string }>();
  const navigate = useNavigate();
  const [thread, setThread] = useState<RelationshipMessageThread | null>(null);
  const [messages, setMessages] = useState<RelationshipMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const isDark = theme === "dark";

  useEffect(() => {
    if (!relationshipId) {
      setLoading(false);
      return;
    }
    let mounted = true;
    getOrCreateRelationshipThread(relationshipId)
      .then(async (nextThread) => {
        if (!mounted) return;
        setThread(nextThread);
        await markRelationshipMessageNotificationsRead(nextThread.id).catch(() => {});
        const list = await listRelationshipMessages(nextThread.id);
        if (mounted) setMessages(list);
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Unable to load this relationship conversation");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [relationshipId]);

  useEffect(() => {
    if (!thread?.id) return;
    const channel = supabase
      .channel(`relationship_messages:${thread.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "relationship_messages", filter: `thread_id=eq.${thread.id}` }, () => {
        void listRelationshipMessages(thread.id).then(setMessages);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [thread?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    const trimmed = body.trim();
    if (!thread || !thread.can_send || !trimmed || sending || trimmed.length > MAX_MESSAGE_LENGTH) return;
    setSending(true);
    setError(null);
    setBody("");
    try {
      await sendRelationshipMessage(thread.id, trimmed);
      setMessages(await listRelationshipMessages(thread.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
      setBody(trimmed);
    } finally {
      setSending(false);
    }
  };

  const canSend = Boolean(thread?.can_send) && body.trim().length > 0 && body.trim().length <= MAX_MESSAGE_LENGTH && !sending;

  if (loading) return <div className={isDark ? "p-4 text-white" : "p-4 text-[#0B1220]"}>Loading…</div>;

  return (
    <div className="flex min-h-[70vh] flex-col" style={{ backgroundColor: isDark ? "#0f172a" : "#F8F9FC", color: isDark ? "#f8fafc" : "#0B1220" }}>
      <header className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: isDark ? "rgba(248,250,252,.1)" : "#E5E7EB" }}>
        <button type="button" onClick={() => navigate(backPath)} className="text-sm font-medium">← Back</button>
        <div>
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-xs opacity-65">This conversation belongs to your established Cleanr relationship, not a single booking.</p>
        </div>
      </header>

      {thread && !thread.can_send ? (
        <div className="mx-4 mt-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: isDark ? "rgba(248,250,252,.12)" : "#E5E7EB" }}>
          This relationship is {thread.relationship_status}. Message history stays available, but new messages are disabled.
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? <p className="text-sm opacity-65">You’re connected. Say hello when it’s useful.</p> : messages.map((message) => {
          const mine = message.sender_role === variant;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%] rounded-2xl px-4 py-2 text-sm" style={{ backgroundColor: mine ? (isDark ? "#1e3a5f" : "#0A84FF") : (isDark ? "rgba(248,250,252,.08)" : "#fff"), color: mine ? "#fff" : undefined }}>
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <p className="mt-1 text-[10px] opacity-65">{formatTime(message.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error ? <p className="px-4 pb-2 text-sm text-red-500">{error}</p> : null}

      <div className="border-t p-4" style={{ borderColor: isDark ? "rgba(248,250,252,.1)" : "#E5E7EB" }}>
        <div className="flex gap-2">
          <input
            value={body}
            disabled={!thread?.can_send}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && canSend) {
                event.preventDefault();
                void handleSend();
              }
            }}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={thread?.can_send ? "Type a message…" : "Messaging is paused"}
            className="flex-1 rounded-xl border px-4 py-3 text-sm disabled:opacity-50"
            style={{ backgroundColor: isDark ? "rgba(30,41,59,.8)" : "#fff", borderColor: isDark ? "rgba(248,250,252,.12)" : "#E5E7EB", color: isDark ? "#f8fafc" : "#0B1220" }}
          />
          <Button type="button" variant="primaryBlue" size="md" disabled={!canSend} onClick={() => void handleSend()}>{sending ? "…" : "Send"}</Button>
        </div>
      </div>
    </div>
  );
}
