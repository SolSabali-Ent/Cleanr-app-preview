import { NavLink, Outlet } from "react-router-dom";
import { adminTheme } from "../theme/adminTheme";

const navItems = [
  { to: "/admin/ops", label: "Operations" },
  { to: "/admin/founding-circle", label: "Founding Circle" },
  { to: "/admin/providers", label: "Providers" },
  { to: "/admin/access", label: "Admin Access" },
  { to: "/admin/geo", label: "Geo Harness" },
];

function AdminSidebar() {
  return (
    <aside
      className="w-64 shrink-0 border-r px-4 py-6"
      style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}
    >
      <p
        className="mb-4 text-xs font-semibold uppercase tracking-wide"
        style={{ color: adminTheme.textSecondary }}
      >
        Admin
      </p>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "text-white" : ""
              }`
            }
            style={({ isActive }) => ({
              backgroundColor: isActive ? adminTheme.primary : "transparent",
              color: isActive ? "#FFFFFF" : adminTheme.textPrimary,
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export function AdminLayout() {
  return (
    <div
      className="admin-app min-h-screen flex"
      style={{ backgroundColor: adminTheme.background, color: adminTheme.textPrimary }}
    >
      <AdminSidebar />
      <div className="admin-content flex-1 p-8">
        <Outlet />
      </div>
    </div>
  );
}
