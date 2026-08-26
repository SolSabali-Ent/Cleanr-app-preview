import { useEffect, useState, useCallback } from "react";
import { useSession } from "../lib/useSession";
import { getUnreadBookingMessageBookingIds } from "../lib/messagingApi";

/**
 * Returns the set of booking_ids that have unread booking_message notifications for the current user.
 * Use for unread indicators on booking/job list rows and message CTAs.
 * Refetches on mount and when the window/tab becomes visible again (focus/visibility).
 */
export function useUnreadBookingMessageIds(): {
  unreadBookingIds: Set<string>;
  refetch: () => Promise<void>;
} {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;
  const [unreadBookingIds, setUnreadBookingIds] = useState<Set<string>>(new Set());

  const refetch = useCallback(async () => {
    if (!userId) {
      setUnreadBookingIds(new Set());
      return;
    }
    try {
      const ids = await getUnreadBookingMessageBookingIds(userId);
      setUnreadBookingIds(ids);
    } catch {
      setUnreadBookingIds(new Set());
    }
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!userId || typeof document === "undefined") return;

    const onVisible = () => void refetch();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onVisible();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onVisible);
    };
  }, [userId, refetch]);

  return { unreadBookingIds, refetch };
}
