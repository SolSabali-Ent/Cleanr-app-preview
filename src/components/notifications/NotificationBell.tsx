import { Bell } from "lucide-react";

type NotificationBellProps = {
  unreadCount: number;
  onClick: () => void;
  tone?: "light" | "dark";
  "aria-label"?: string;
};

export function NotificationBell({
  unreadCount,
  onClick,
  tone = "light",
  "aria-label": ariaLabel = "Notifications",
}: NotificationBellProps) {
  const isDark = tone === "dark";
  const showBadge = unreadCount > 0;
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative p-2 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0000FE] focus-visible:ring-offset-2"
      style={{
        color: isDark ? "#f8fafc" : "#0B1220",
      }}
      aria-label={ariaLabel}
      aria-live="polite"
      aria-atomic="true"
    >
      <Bell className="w-5 h-5" strokeWidth={2} />
      {showBadge ? (
        <span
          className="absolute top-0 right-0 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold text-white"
          style={{ backgroundColor: "#DC2626", padding: "0 4px" }}
          aria-hidden
        >
          {badgeLabel}
        </span>
      ) : null}
    </button>
  );
}
