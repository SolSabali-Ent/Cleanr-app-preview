import { NavLink } from "react-router-dom";
import { Home, Briefcase, CalendarDays, DollarSign, User } from "lucide-react";
import { CSP_SURFACE, CSP_PRIMARY_BUTTON, CSP_TEXT_SECONDARY } from "@/theme/cspTheme";

const navItems = [
  { to: "/csp/dashboard", label: "Home", icon: Home },
  { to: "/csp/dashboard/jobs", label: "Jobs", icon: Briefcase },
  { to: "/csp/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/csp/dashboard/earnings", label: "Earnings", icon: DollarSign },
  { to: "/csp/dashboard/profile", label: "Profile", icon: User },
];

export default function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex justify-center pb-safe"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
    >
      <div className="w-full max-w-[560px] px-4">
        <div
          className="flex items-center justify-between rounded-2xl px-2 py-2"
          style={{
            backgroundColor: CSP_SURFACE,
            border: `1px solid rgba(248, 250, 252, 0.08)`,
          }}
        >
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/csp/dashboard"}
              className="flex flex-col items-center flex-1 py-1.5 text-xs transition-colors rounded-xl min-w-0"
            >
              {({ isActive }) => (
                <>
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-lg mb-0.5 transition-colors"
                    style={{
                      backgroundColor: isActive
                        ? `${CSP_PRIMARY_BUTTON}20`
                        : "transparent",
                    }}
                  >
                    <Icon
                      size={20}
                      strokeWidth={2}
                      style={{
                        color: isActive ? CSP_PRIMARY_BUTTON : CSP_TEXT_SECONDARY,
                      }}
                    />
                  </div>
                  <span
                    className="leading-none truncate w-full text-center"
                    style={{
                      color: isActive ? CSP_PRIMARY_BUTTON : CSP_TEXT_SECONDARY,
                    }}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
