import { NavLink, useLocation } from "react-router-dom";
import { Home, CalendarDays, Sparkles } from "lucide-react";
import { customerRouteForContext } from "@/lib/contextualRoutes";
import { ProfileNavAvatar } from "@/components/navigation/ProfileNavAvatar";

const tabs = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/app/provider", label: "My CSP", icon: Sparkles },
  { to: "/app/profile", label: "Profile", icon: null },
];

export function CustomerBottomNav() {
  const { pathname } = useLocation();
  const isAdminPreview = pathname.startsWith("/admin/full-app/customer");

  return (
    <nav
      className="customer-bottom-nav"
      style={{
        ...(isAdminPreview ? { position: "absolute" as const } : null),
        height: "calc(72px + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {tabs.map((tab) => {
        const target = customerRouteForContext(pathname, tab.to);
        return (
          <NavLink
            key={tab.to}
            to={target}
            end={tab.to === "/app"}
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""} flex h-full flex-1 touch-manipulation select-none flex-col items-center justify-center text-xs font-medium`
            }
          >
            {({ isActive }) => (
              <>
                {tab.to === "/app/profile" ? (
                  <div className="mb-1 flex h-4 w-4 items-center justify-center">
                    <ProfileNavAvatar
                      size={18}
                      active={isActive}
                      activeColor="#166534"
                      inactiveColor="#667085"
                    />
                  </div>
                ) : tab.icon ? (
                  <tab.icon className="mb-1 h-4 w-4" strokeWidth={2.2} />
                ) : null}
                <span>{tab.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
