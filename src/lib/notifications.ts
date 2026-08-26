import { supabase } from "./supabase";

export interface Notification {
  id: string;
  recipient_id: string;
  role: "customer" | "csp";
  category: string;
  title: string;
  body: string | null;
  cta_path: string | null;
  cta_label: string | null;
  read_at: string | null;
  created_at: string;
  payload: Record<string, unknown>;
}

const DEFAULT_LIMIT = 50;

/**
 * Fetch notifications for the current user (RLS enforces recipient_id = auth.uid()).
 * Newest first.
 */
export async function listNotifications(
  recipientId: string,
  limit: number = DEFAULT_LIMIT
): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, recipient_id, role, category, title, body, cta_path, cta_label, read_at, created_at, payload")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

/**
 * Unread count for the current user.
 */
export async function getUnreadCount(recipientId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", recipientId)
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Mark one notification as read.
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw error;
}

/**
 * Mark all notifications for the current user as read.
 */
export async function markAllAsRead(recipientId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", recipientId)
    .is("read_at", null);
  if (error) throw error;
}
