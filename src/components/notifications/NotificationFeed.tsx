import { useNavigate } from "react-router-dom";
import type { Notification } from "../../lib/notifications";
import { normalizeCspNavigationHref } from "../../lib/cspPostLoginRedirect";
import { NotificationRow } from "./NotificationRow";
import { Button } from "../ui/Button";

type NotificationFeedProps = {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  onClose: () => void;
  tone?: "light" | "dark";
};

export function NotificationFeed({
  notifications,
  loading,
  error,
  unreadCount,
  markAsRead,
  markAllAsRead,
  onClose,
  tone = "light",
}: NotificationFeedProps) {
  const navigate = useNavigate();
  const isDark = tone === "dark";

  const handleNavigate = (path: string) => {
    if (path.startsWith("/")) {
      navigate(normalizeCspNavigationHref(path));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: isDark ? "#94a3b8" : "#667085" }}>
          Loading…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm" style={{ color: isDark ? "#f87171" : "#DC2626" }}>
          {error}
        </p>
      </div>
    );
  }

  const hasItems = notifications.length > 0;

  return (
    <div className="flex flex-col gap-4 min-h-0">
      {unreadCount > 0 && hasItems ? (
        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markAllAsRead()}
          >
            Mark all as read
          </Button>
        </div>
      ) : null}
      {!hasItems ? (
        <div
          className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-[14px] border border-dashed"
          style={{
            borderColor: isDark ? "rgba(248, 250, 252, 0.2)" : "#E5E7EB",
            color: isDark ? "#94a3b8" : "#667085",
          }}
        >
          <p className="text-sm font-medium">No notifications yet</p>
          <p className="text-xs mt-1">
            When you get updates about bookings and account activity, they’ll show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto min-h-0 -mx-1 px-1">
          {notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onMarkRead={(id) => markAsRead(id)}
              onNavigate={handleNavigate}
              onClose={onClose}
              tone={tone}
            />
          ))}
        </div>
      )}
    </div>
  );
}
