import { NavLink, useLocation } from "react-router-dom";
import { Home, CalendarDays, UserCircle2, Sparkles } from "lucide-react";
import { customerRouteForContext } from "@/lib/contextualRoutes";

const tabs = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/app/provider", label: "My CSP", icon: Sparkles },
  { to: "/app/profile", label: "Profile", icon: UserCircle2 },
];

export function CustomerBottomNav() {
  const { pathname } = useLocation();
  const isAdminPreview = pathname.startsWith("/admin/full-app/customer");

  return (
    <nav className="customer-bottom-nav" style={isAdminPreview ? { position: "absolute" } : undefined}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const target = customerRouteForContext(pathname, tab.to);
        return (
          <NavLink
            key={tab.to}
            to={target}
            end={tab.to === "/app"}
            className={({ isActive }) =>
              `nav-item ${isActive ? "active" : ""} flex flex-col items-center justify-center text-xs font-medium`
            }
          >
            <Icon className="h-4 w-4 mb-1" strokeWidth={2.2} />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
