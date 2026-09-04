import { NavLink, Outlet } from "react-router-dom";
import { Monitor } from "lucide-react";
import { adminTheme } from "../theme/adminTheme";

const navItems = [
  { to: "/admin/ops", label: "Operations" },
  { to: "/admin/full-app", label: "Super Admin" },
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

function AdminDesktopRequired() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 px-6 py-10 lg:hidden">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Monitor className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-slate-900">Admin is desktop only</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Open the Cleanr admin workspace on a desktop-sized screen to continue.
        </p>
      </div>
    </div>
  );
}

export function AdminLayout() {
  return (
    <>
      <AdminDesktopRequired />
      <div
        className="admin-app hidden min-h-screen lg:flex"
        style={{ backgroundColor: adminTheme.background, color: adminTheme.textPrimary }}
      >
        <AdminSidebar />
        <div className="admin-content min-w-0 flex-1 p-8">
          <Outlet />
        </div>
      </div>
    </>
  );
}
