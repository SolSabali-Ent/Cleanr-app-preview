import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut, Monitor } from "lucide-react";
import { adminTheme } from "../theme/adminTheme";
import { providerTheme } from "../theme/providerTheme";
import { LANDING_LOGO_HERO_SRC } from "../lib/brand";
import { signOutCleanr } from "../lib/authSession";

const navItems = [
  { to: "/admin/ops", label: "Operations" },
  { to: "/admin/circles", label: "Circles" },
  { to: "/admin/collective-capacity", label: "Collective Capacity" },
  { to: "/admin/opportunity-circulation", label: "Opportunity Circulation" },
  { to: "/admin/affiliate-cashouts", label: "Affiliate Cash-outs" },
  { to: "/admin/full-app", label: "Super Admin" },
  { to: "/admin/founding-circle", label: "Founding Circle" },
  { to: "/admin/providers", label: "Providers" },
  { to: "/admin/access", label: "Admin Access" },
  { to: "/admin/geo", label: "Geo Harness" },
];

function AdminSidebar() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);

    try {
      await signOutCleanr();
      navigate("/signin?reason=signed-out", { replace: true });
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : "Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  };

  return (
    <aside
      className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r"
      style={{
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: providerTheme.background,
      }}
    >
      <div className="border-b border-white/10 px-5 pb-5 pt-6">
        <img
          src={LANDING_LOGO_HERO_SRC}
          alt="Cleanr"
          width={906}
          height={209}
          className="h-12 w-auto max-w-[190px] object-contain object-left"
        />
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-300/80">
          Admin Console
        </p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            style={({ isActive }) => ({
              backgroundColor: isActive ? adminTheme.primary : "transparent",
              color: isActive ? "#FFFFFF" : providerTheme.textSecondary,
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Account</p>
        <p className="mt-2 text-base font-semibold text-white">Cleanr Ops</p>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
          style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {signingOut ? "Signing out…" : "Sign out"}
        </button>

        {signOutError ? (
          <p className="mt-2 text-xs leading-5 text-red-300" role="alert">
            {signOutError}
          </p>
        ) : null}
      </div>
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
