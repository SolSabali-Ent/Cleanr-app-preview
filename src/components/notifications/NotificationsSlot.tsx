import { useState } from "react";
import BottomSheet from "../ui/BottomSheet";
import type { Snap } from "../ui/BottomSheet";
import { useNotifications } from "../../hooks/useNotifications";
import { NotificationBell } from "./NotificationBell";
import { NotificationFeed } from "./NotificationFeed";

type NotificationsSlotProps = {
  variant: "customer" | "provider";
};

export function NotificationsSlot({ variant }: NotificationsSlotProps) {
  const [feedOpen, setFeedOpen] = useState(false);
  const [snap, setSnap] = useState<Snap>("large");
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refetch,
  } = useNotifications();

  const tone = variant === "provider" ? "dark" : "light";

  const openFeed = () => {
    refetch();
    setFeedOpen(true);
  };

  return (
    <>
      <NotificationBell
        unreadCount={unreadCount}
        onClick={openFeed}
        tone={tone}
      />
      <BottomSheet
        open={feedOpen}
        onClose={() => setFeedOpen(false)}
        snap={snap}
        setSnap={setSnap}
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : undefined}
        tone={tone}
      >
        <NotificationFeed
          notifications={notifications}
          loading={loading}
          error={error}
          unreadCount={unreadCount}
          markAsRead={markAsRead}
          markAllAsRead={markAllAsRead}
          onClose={() => setFeedOpen(false)}
          tone={tone}
        />
      </BottomSheet>
    </>
  );
}
