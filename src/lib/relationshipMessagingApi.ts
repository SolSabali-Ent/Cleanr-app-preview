import { supabase } from "./supabase";
import { MAX_MESSAGE_LENGTH } from "./messagingApi";

export type RelationshipMessageThread = {
  id: string;
  service_relationship_id: string;
  customer_id: string;
  provider_id: string;
  relationship_status: "active" | "paused" | "ended";
  can_send: boolean;
  created_at: string;
  updated_at: string;
};

export type RelationshipMessage = {
  id: string;
  thread_id: string;
  service_relationship_id: string;
  sender_id: string;
  sender_role: "customer" | "csp";
  body: string;
  created_at: string;
};

export async function getOrCreateRelationshipThread(relationshipId: string): Promise<RelationshipMessageThread> {
  const { data, error } = await supabase.rpc("get_or_create_relationship_thread", { p_relationship_id: relationshipId });
  if (error) throw error;
  const row = data as RelationshipMessageThread | null;
  if (!row?.id) throw new Error("Invalid relationship thread response");
  return row;
}

export async function listRelationshipMessages(threadId: string): Promise<RelationshipMessage[]> {
  const { data, error } = await supabase
    .from("relationship_messages")
    .select("id,thread_id,service_relationship_id,sender_id,sender_role,body,created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RelationshipMessage[];
}

export async function sendRelationshipMessage(threadId: string, body: string): Promise<{ id: string }> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message cannot be empty");
  if (trimmed.length > MAX_MESSAGE_LENGTH) throw new Error("Message is too long");
  const { data, error } = await supabase.rpc("send_relationship_message", { p_thread_id: threadId, p_body: trimmed });
  if (error) throw error;
  const row = data as { id?: string } | null;
  if (!row?.id) throw new Error("Invalid send response");
  return { id: row.id };
}

export async function markRelationshipMessageNotificationsRead(threadId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_relationship_message_notifications_read", { p_thread_id: threadId });
  if (error) throw error;
}
