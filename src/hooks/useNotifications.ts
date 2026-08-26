import { useEffect, useState, useCallback } from "react";
import { useSession } from "../lib/useSession";
import type { Notification } from "../lib/notifications";
import {
  listNotifications,
  getUnreadCount,
  markAsRead as markAsReadApi,
  markAllAsRead as markAllAsReadApi,
} from "../lib/notifications";
import { supabase } from "../lib/supabase";

export function useNotifications(): {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
} {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [list, count] = await Promise.all([
        listNotifications(userId),
        getUnreadCount(userId),
      ]);
      setNotifications(list);
      setUnreadCount(count);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load notifications");
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime: refetch when notifications for this user change (INSERT or UPDATE e.g. read_at).
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          void fetchData();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchData]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!userId) return;
      try {
        await markAsReadApi(id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === id ? { ...n, read_at: new Date().toISOString() } : n
          )
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Optimistic revert or leave as-is; refetch on next open if needed
        await fetchData();
      }
    },
    [userId, fetchData]
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    try {
      await markAllAsReadApi(userId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      await fetchData();
    }
  }, [userId, fetchData]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refetch: fetchData,
  };
}
