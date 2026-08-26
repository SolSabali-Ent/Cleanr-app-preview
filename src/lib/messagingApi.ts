import { supabase } from "./supabase";

/** Max message body length (chars). Enforced in DB and send_booking_message RPC. */
export const MAX_MESSAGE_LENGTH = 2000;

export type BookingMessage = {
  id: string;
  thread_id: string;
  booking_id: string;
  sender_id: string;
  sender_role: "customer" | "csp";
  body: string;
  created_at: string;
};

export type BookingMessageThread = {
  id: string;
  booking_id: string;
  customer_id: string;
  provider_id: string;
  created_at: string;
  updated_at: string;
};

/**
 * Get or create the message thread for a booking. Caller must be the booking's customer or assigned provider.
 */
export async function getOrCreateBookingThread(
  bookingId: string
): Promise<BookingMessageThread> {
  const { data, error } = await supabase.rpc("get_or_create_booking_thread", {
    p_booking_id: bookingId,
  });
  if (error) throw error;
  const row = data as BookingMessageThread;
  if (!row?.id) throw new Error("Invalid thread response");
  return row;
}

/**
 * Get thread by booking_id. For admin read-only viewer; participants use getOrCreateBookingThread.
 * Returns null if no thread exists yet (no messages sent).
 */
export async function getBookingThreadByBookingId(
  bookingId: string
): Promise<BookingMessageThread | null> {
  const { data, error } = await supabase
    .from("booking_message_threads")
    .select("id, booking_id, customer_id, provider_id, created_at, updated_at")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw error;
  return (data as BookingMessageThread | null) ?? null;
}

/**
 * List messages in a thread (newest last). RLS: participants or admin can read.
 */
export async function listBookingMessages(threadId: string): Promise<BookingMessage[]> {
  const { data, error } = await supabase
    .from("booking_messages")
    .select("id, thread_id, booking_id, sender_id, sender_role, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BookingMessage[];
}

/**
 * Send a message. Sender role is enforced server-side from profiles.role.
 * Trims body; backend rejects empty/whitespace-only and messages over MAX_MESSAGE_LENGTH.
 */
export async function sendBookingMessage(
  threadId: string,
  body: string
): Promise<{ id: string }> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message cannot be empty");
  if (trimmed.length > MAX_MESSAGE_LENGTH) throw new Error("Message is too long");
  const { data, error } = await supabase.rpc("send_booking_message", {
    p_thread_id: threadId,
    p_body: trimmed,
  });
  if (error) throw error;
  const result = data as { id: string } | null;
  if (!result?.id) throw new Error("Invalid send response");
  return result;
}

/**
 * Mark booking_message notifications for this thread as read for the current user.
 * Call when the user opens the thread.
 */
export async function markBookingMessageNotificationsRead(
  threadId: string
): Promise<void> {
  const { error } = await supabase.rpc("mark_booking_message_notifications_read", {
    p_thread_id: threadId,
  });
  if (error) throw error;
}

/**
 * Fetch booking_ids that have unread booking_message notifications for the given recipient.
 * Used for unread indicators on booking/job rows and message CTAs.
 * RLS: recipient can only read own notifications.
 */
export async function getUnreadBookingMessageBookingIds(
  recipientId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("notifications")
    .select("payload")
    .eq("recipient_id", recipientId)
    .eq("category", "booking_message")
    .is("read_at", null);
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const payload = row?.payload as Record<string, unknown> | null;
    const bid = payload?.booking_id;
    if (typeof bid === "string" && bid) ids.add(bid);
  }
  return ids;
}
