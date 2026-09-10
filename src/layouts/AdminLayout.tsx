import { useEffect, useState, type ComponentType } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  Banknote,
  Boxes,
  CircleDot,
  Gauge,
  KeyRound,
  LogOut,
  Map,
  MessageSquareWarning,
  Monitor,
  Network,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  Wrench,
} from "lucide-react";
import { adminTheme } from "../theme/adminTheme";
import { providerTheme } from "../theme/providerTheme";
import { LANDING_LOGO_HERO_SRC } from "../lib/brand";
import { signOutCleanr } from "../lib/authSession";
import { supabase } from "../lib/supabase";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

type ZipDemandRow = {
  zip: string;
  request_count: number;
  unique_people: number;
  latest_request_at: string | null;
  unsupported_count: number;
  supply_building_count: number;
  market_not_active_count: number;
};

const navGroups: NavGroup[] = [
  {
    label: "Operate",
    items: [
      { to: "/admin/ops", label: "Operations", icon: Gauge },
      { to: "/admin/missed-visit-payments", label: "Booking exceptions", icon: Banknote },
      { to: "/admin/relationship-recovery", label: "Recovery", icon: Activity },
      { to: "/admin/message-safety", label: "Message safety", icon: MessageSquareWarning },
    ],
  },
  {
    label: "People",
    items: [
      { to: "/admin/providers", label: "Applications", icon: UserRoundCheck },
      { to: "/admin/csp-directory", label: "CSP directory", icon: UsersRound },
      { to: "/admin/access", label: "Admin access", icon: KeyRound },
    ],
  },
  {
    label: "Network",
    items: [
      { to: "/admin/circles", label: "Circles", icon: CircleDot },
      { to: "/admin/transformation-metrics", label: "Metrics", icon: Activity },
      { to: "/admin/collective-demand", label: "Demand", icon: Search },
      { to: "/admin/collective-capacity", label: "Capacity", icon: Boxes },
      { to: "/admin/opportunity-circulation", label: "Circulation", icon: Network },
    ],
  },
  {
    label: "Programs",
    items: [
      { to: "/admin/founding-circle", label: "Founding Circle", icon: ShieldCheck },
      { to: "/admin/affiliate-cashouts", label: "Affiliate cash-outs", icon: Banknote },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/admin/full-app", label: "Full app inspector", icon: Monitor },
      { to: "/admin/geo", label: "Geo harness", icon: Map },
    ],
  },
];

function demandLabel(row: ZipDemandRow): string {
  if (row.unsupported_count > 0) return "Not served yet";
  if (row.supply_building_count > 0) return "Needs CSP coverage";
  return "Waiting";
}

function AdminSidebar() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [zipDemand, setZipDemand] = useState<ZipDemandRow[]>([]);

  useEffect(() => {
    let active = true;
    void supabase.rpc("get_admin_waitlist_zip_demand").then(({ data, error }) => {
      if (!active || error) return;
      setZipDemand(((data ?? []) as ZipDemandRow[]).slice(0, 5));
    });
    return () => { active = false; };
  }, []);

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
      className="flex h-full w-[248px] shrink-0 flex-col overflow-hidden border-r"
      style={{
        borderColor: "rgba(255,255,255,0.10)",
        backgroundColor: providerTheme.background,
      }}
    >
      <div className="border-b border-white/10 px-5 pb-4 pt-5">
        <img
          src={LANDING_LOGO_HERO_SRC}
          alt="Cleanr"
          width={906}
          height={209}
          className="h-10 w-auto max-w-[170px] object-contain object-left"
        />
        <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
          <Wrench className="h-3 w-3" aria-hidden />
          Admin workspace
        </div>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4 overscroll-contain">
        <div className="space-y-5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{group.label}</p>
              <div className="mt-1.5 space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors"
                      style={({ isActive }) => ({
                        backgroundColor: isActive ? "rgba(255,255,255,0.10)" : "transparent",
                        color: isActive ? "#FFFFFF" : providerTheme.textSecondary,
                      })}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}

          {zipDemand.length > 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Area requests</p>
                <Map className="h-3.5 w-3.5 text-white/35" aria-hidden />
              </div>
              <p className="mt-1 text-[11px] leading-4 text-white/45">Where people are asking Cleanr to grow.</p>
              <div className="mt-2 space-y-1.5">
                {zipDemand.map((row) => (
                  <div key={row.zip} className="rounded-lg bg-white/[0.05] px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-white">{row.zip}</span>
                      <span className="text-[10px] font-semibold text-[#8DCC64]">{row.unique_people} {row.unique_people === 1 ? "person" : "people"}</span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-white/45">{demandLabel(row)}</p>
                  </div>
                ))}
              </div>
              <NavLink to="/admin/collective-demand" className="mt-2 inline-flex text-[11px] font-semibold text-white/70 hover:text-white">Open demand →</NavLink>
            </div>
          ) : null}
        </div>
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">Account</p>
            <p className="mt-1 truncate text-sm font-semibold text-white">Cleanr Ops</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-50"
            aria-label={signingOut ? "Signing out" : "Sign out"}
            title={signingOut ? "Signing out…" : "Sign out"}
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {signOutError ? <p className="mt-2 text-xs leading-5 text-red-300" role="alert">{signOutError}</p> : null}
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
        <p className="mt-2 text-sm leading-6 text-slate-600">Open the Cleanr admin workspace on a desktop-sized screen to continue.</p>
      </div>
    </div>
  );
}

export function AdminLayout() {
  return (
    <>
      <AdminDesktopRequired />
      <div
        className="admin-app hidden h-[100dvh] overflow-hidden lg:flex"
        style={{ backgroundColor: adminTheme.background, color: adminTheme.textPrimary }}
      >
        <AdminSidebar />
        <div className="admin-content h-full min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-7 py-6 xl:px-9 xl:py-8">
          <Outlet />
        </div>
      </div>
    </>
  );
}
