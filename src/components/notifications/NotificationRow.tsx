import type { Notification } from "../../lib/notifications";

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  } catch {
    return "";
  }
}

type NotificationRowProps = {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onNavigate?: (path: string) => void;
  onClose?: () => void;
  tone?: "light" | "dark";
};

export function NotificationRow({
  notification,
  onMarkRead,
  onNavigate,
  onClose,
  tone = "light",
}: NotificationRowProps) {
  const isUnread = !notification.read_at;
  const isDark = tone === "dark";

  const handleClick = () => {
    if (isUnread) onMarkRead(notification.id);
    const path = notification.cta_path?.trim();
    if (path) {
      onClose?.();
      onNavigate?.(path);
    }
  };

  const title = notification.title ?? "";
  const body = notification.body?.trim() ?? "";
  const timeLabel = formatRelativeTime(notification.created_at);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full text-left rounded-[14px] border p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0000FE] focus-visible:ring-offset-2"
      style={{
        borderColor: isDark ? "rgba(248, 250, 252, 0.12)" : "#E5E7EB",
        backgroundColor: isUnread && isDark ? "rgba(255,255,255,0.06)" : isUnread ? "#F8FAFC" : "transparent",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium truncate"
            style={{ color: isDark ? "#f8fafc" : "#0B1220" }}
          >
            {title || "Notification"}
          </p>
          {body ? (
            <p
              className="text-xs mt-0.5 line-clamp-2"
              style={{ color: isDark ? "#94a3b8" : "#667085" }}
            >
              {body}
            </p>
          ) : null}
        </div>
        <span
          className="shrink-0 text-xs"
          style={{ color: isDark ? "#64748b" : "#94a3b8" }}
        >
          {timeLabel}
        </span>
      </div>
    </button>
  );
}
