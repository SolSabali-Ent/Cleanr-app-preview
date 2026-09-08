import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useCspDashboardChrome } from "../../contexts/CspDashboardChromeContext";
import { AdminSearchField, AdminTabs } from "./AdminUi";

type RouteKind = "public" | "customer" | "csp" | "growth" | "admin";
type RouteEntry = { label: string; original: string; preview?: string; note?: string; dynamic?: "booking" | "provider" | "job" | "step" };
type RouteSection = { title: string; kind: RouteKind; routes: RouteEntry[] };

const SECTIONS: RouteSection[] = [
  { title: "Public + booking", kind: "public", routes: [
    { label: "Landing", original: "/", preview: "/admin/full-app/public" }, { label: "Customer sign in", original: "/signin", preview: "/admin/full-app/public/signin" }, { label: "Role dashboard resolver", original: "/dashboard", note: "Redirect-only route; behavior depends on authenticated role/state." }, { label: "Provider hub", original: "/csp", preview: "/admin/full-app/public/csp" }, { label: "Founding Circle recruiting", original: "/csp/founding-circle", preview: "/admin/full-app/public/csp/founding-circle" }, { label: "Provider sign in", original: "/csp/login", preview: "/admin/full-app/public/csp/login" }, { label: "Provider sign up", original: "/csp/signup", preview: "/admin/full-app/public/csp/signup" }, { label: "Booking flow", original: "/book", preview: "/admin/full-app/public/book" }, { label: "Start booking alias", original: "/start-booking", note: "Redirect → /book" }, { label: "Service alias", original: "/service", note: "Redirect → /book" }, { label: "Booking confirmation", original: "/booking-confirmed", preview: "/admin/full-app/public/booking-confirmed" }, { label: "Trust & Safety", original: "/trust-safety", preview: "/admin/full-app/public/trust-safety" }, { label: "Legacy provider alias", original: "/provider", note: "Redirect → /csp/login" }, { label: "Legacy onboarding alias", original: "/onboarding", note: "Redirect → /csp/dashboard" }, { label: "CSP onboarding alias", original: "/csp/onboarding", note: "Redirect → /csp/dashboard" },
  ]},
  { title: "Customer app", kind: "customer", routes: [
    { label: "Customer home", original: "/app", preview: "/admin/full-app/customer" }, { label: "Bookings / schedule", original: "/app/bookings", preview: "/admin/full-app/customer/bookings" }, { label: "Booking details", original: "/app/bookings/:bookingId", preview: "/admin/full-app/customer/bookings/:bookingId", dynamic: "booking" }, { label: "Before your cleaning", original: "/app/bookings/:bookingId/prep", preview: "/admin/full-app/customer/bookings/:bookingId/prep", dynamic: "booking" }, { label: "Booking message", original: "/app/bookings/:bookingId/message", preview: "/admin/full-app/customer/bookings/:bookingId/message", dynamic: "booking" }, { label: "Provider relationship overview", original: "/app/provider", preview: "/admin/full-app/customer/provider" }, { label: "Provider list", original: "/app/provider/list", preview: "/admin/full-app/customer/provider/list" }, { label: "Provider detail", original: "/app/provider/:providerId", preview: "/admin/full-app/customer/provider/:providerId", dynamic: "provider" }, { label: "Customer profile", original: "/app/profile", preview: "/admin/full-app/customer/profile" }, { label: "Payments", original: "/app/payments", preview: "/admin/full-app/customer/payments" }, { label: "Service addresses", original: "/app/addresses", preview: "/admin/full-app/customer/addresses" }, { label: "Share & earn", original: "/app/affiliate", preview: "/admin/full-app/customer/affiliate" }, { label: "Help & safety", original: "/app/support", preview: "/admin/full-app/customer/support" }, { label: "Urgent booking help", original: "/app/emergency", preview: "/admin/full-app/customer/emergency" },
  ]},
  { title: "CSP app", kind: "csp", routes: [
    { label: "Candidate readiness", original: "/csp/dashboard/candidate-readiness", preview: "/admin/full-app/csp/candidate-readiness" }, { label: "Onboarding wizard", original: "/csp/dashboard/onboarding", preview: "/admin/full-app/csp/onboarding" }, { label: "Verification", original: "/csp/dashboard/verification", preview: "/admin/full-app/csp/verification" }, { label: "Application status", original: "/csp/dashboard/application-status", preview: "/admin/full-app/csp/application-status" }, { label: "Terms", original: "/csp/dashboard/terms", preview: "/admin/full-app/csp/terms" }, { label: "Application hub", original: "/csp/dashboard/application", preview: "/admin/full-app/csp/application" }, { label: "Application step", original: "/csp/dashboard/application/:step", preview: "/admin/full-app/csp/application/:step", dynamic: "step" }, { label: "CSP home", original: "/csp/dashboard", preview: "/admin/full-app/csp" }, { label: "Jobs", original: "/csp/dashboard/jobs", preview: "/admin/full-app/csp/jobs" }, { label: "Job detail", original: "/csp/dashboard/jobs/:jobId", preview: "/admin/full-app/csp/jobs/:jobId", dynamic: "job" }, { label: "Job message", original: "/csp/dashboard/jobs/:jobId/message", preview: "/admin/full-app/csp/jobs/:jobId/message", dynamic: "job" }, { label: "Incident log", original: "/csp/dashboard/jobs/:jobId/incident", preview: "/admin/full-app/csp/jobs/:jobId/incident", dynamic: "job" }, { label: "Calendar", original: "/csp/dashboard/calendar", preview: "/admin/full-app/csp/calendar" }, { label: "Earnings", original: "/csp/dashboard/earnings", preview: "/admin/full-app/csp/earnings" }, { label: "Share Cleanr & earn", original: "/csp/dashboard/affiliate", preview: "/admin/full-app/csp/affiliate" }, { label: "Existing clients", original: "/csp/dashboard/existing-clients", preview: "/admin/full-app/csp/existing-clients" }, { label: "Availability alias", original: "/csp/dashboard/availability", preview: "/admin/full-app/csp/availability", note: "Redirects to Calendar → Availability." }, { label: "CSP profile", original: "/csp/dashboard/profile", preview: "/admin/full-app/csp/profile" },
  ]},
  { title: "Growth + Network", kind: "growth", routes: [
    { label: "Growth home", original: "/csp/growth", preview: "/admin/full-app/csp/growth" }, { label: "Milestones", original: "/csp/growth/milestones", preview: "/admin/full-app/csp/growth/milestones" }, { label: "Capabilities", original: "/csp/growth/capabilities", preview: "/admin/full-app/csp/growth/capabilities" }, { label: "Opportunities", original: "/csp/growth/opportunities", preview: "/admin/full-app/csp/growth/opportunities" }, { label: "Opportunity fit alias", original: "/csp/growth/fit", note: "Redirect → /csp/growth/opportunities" }, { label: "Network", original: "/csp/growth/network", preview: "/admin/full-app/csp/growth/network" }, { label: "Contributions", original: "/csp/growth/contributions", preview: "/admin/full-app/csp/growth/contributions" }, { label: "Dashboard growth alias", original: "/csp/dashboard/growth", note: "Redirect → /csp/growth" }, { label: "Dashboard milestones alias", original: "/csp/dashboard/growth/milestones", note: "Redirect → /csp/growth/milestones" }, { label: "Dashboard capabilities alias", original: "/csp/dashboard/growth/capabilities", note: "Redirect → /csp/growth/capabilities" }, { label: "Dashboard opportunities alias", original: "/csp/dashboard/growth/opportunities", note: "Redirect → /csp/growth/opportunities" }, { label: "Dashboard opportunity fit alias", original: "/csp/dashboard/growth/opportunities/fit", note: "Redirect → /csp/growth/opportunities" }, { label: "Dashboard network alias", original: "/csp/dashboard/growth/network", note: "Redirect → /csp/growth/network" }, { label: "Dashboard contributions alias", original: "/csp/dashboard/growth/contributions", note: "Redirect → /csp/growth/contributions" },
  ]},
  { title: "Admin", kind: "admin", routes: [
    { label: "Admin root", original: "/admin", note: "Redirect → /admin/ops" }, { label: "Operations", original: "/admin/ops" }, { label: "Circles", original: "/admin/circles" }, { label: "Transformation Metrics", original: "/admin/transformation-metrics" }, { label: "Relationship Recovery", original: "/admin/relationship-recovery" }, { label: "Collective Demand", original: "/admin/collective-demand" }, { label: "Collective Capacity", original: "/admin/collective-capacity" }, { label: "Opportunity Circulation", original: "/admin/opportunity-circulation" }, { label: "Affiliate cash-outs", original: "/admin/affiliate-cashouts" }, { label: "Founding Circle", original: "/admin/founding-circle" }, { label: "Providers", original: "/admin/providers" }, { label: "CSP directory", original: "/admin/csp-directory" }, { label: "Admin access", original: "/admin/access" }, { label: "Geo harness", original: "/admin/geo" }, { label: "Admin booking messages", original: "/admin/booking/:bookingId/messages", dynamic: "booking" }, { label: "Full app inspector", original: "/admin/full-app" },
  ]},
];

function substituteDynamic(path: string, kind: RouteEntry["dynamic"], bookingId: string, providerId: string, step: string) {
  if (!kind) return path;
  if (kind === "booking") return bookingId ? path.replace(":bookingId", bookingId) : null;
  if (kind === "job") return bookingId ? path.replace(":jobId", bookingId) : null;
  if (kind === "provider") return providerId ? path.replace(":providerId", providerId) : null;
  if (kind === "step") return step ? path.replace(":step", step) : null;
  return null;
}

export function AdminFullAppShell() {
  return (
    <div className="-m-8 min-h-screen bg-slate-100">
      <header className="relative z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Product inspector</p><p className="mt-0.5 text-sm font-semibold text-slate-950">Cleanr surfaces</p></div>
        <div className="flex items-center gap-2"><Link to="/admin/full-app" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Screen index</Link><Link to="/admin/ops" className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">Back to Ops</Link></div>
      </header>
      <Outlet />
    </div>
  );
}

export function AdminAppPreviewFrame() {
  const location = useLocation();
  const surface = location.pathname.includes("/customer") ? "Customer app" : location.pathname.includes("/csp") ? "CSP app" : "Public / booking";
  return (
    <main className="min-h-[calc(100vh-64px)] bg-slate-100 px-4 py-6">
      <div className="mx-auto w-full max-w-[430px]">
        <div className="mb-2 flex items-center justify-between px-1 text-xs font-medium text-slate-500"><span>{surface}</span><span>390 × 844</span></div>
        <div className="admin-app-preview-frame relative mx-auto w-full max-w-[390px] overflow-y-auto overflow-x-hidden rounded-[32px] border-[10px] border-white bg-white shadow-xl ring-1 ring-slate-300" style={{ height: "min(844px, calc(100dvh - 150px))", minHeight: "560px" }}><Outlet /></div>
        <p className="mt-3 px-2 text-center text-[11px] leading-4 text-slate-500">Inspector mode bypasses route gates only. RLS, ownership, and real write permissions remain unchanged.</p>
      </div>
    </main>
  );
}

export function AdminProviderPreviewOutlet() {
  const location = useLocation();
  const { setShowDashboardChrome } = useCspDashboardChrome();
  useLayoutEffect(() => {
    const p = location.pathname;
    const setup = p.includes("/candidate-readiness") || p.includes("/onboarding") || p.includes("/verification") || p.includes("/application-status") || p.includes("/terms") || p.includes("/application");
    setShowDashboardChrome(!setup);
    return () => setShowDashboardChrome(false);
  }, [location.pathname, setShowDashboardChrome]);
  return <Outlet />;
}

export function AdminFullAppIndex() {
  const [bookingId, setBookingId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [step, setStep] = useState("");
  const [kind, setKind] = useState<RouteKind>("customer");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      supabase.from("bookings").select("id").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("profiles").select("id").eq("role", "csp").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]).then(([booking, provider]) => {
      if (cancelled) return;
      if (!booking.error && booking.data?.id) setBookingId(String(booking.data.id));
      if (!provider.error && provider.data?.id) setProviderId(String(provider.data.id));
    });
    return () => { cancelled = true; };
  }, []);

  const routeCount = useMemo(() => SECTIONS.reduce((sum, section) => sum + section.routes.length, 0), []);
  const section = SECTIONS.find((entry) => entry.kind === kind) ?? SECTIONS[0];
  const visibleRoutes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return section.routes;
    return section.routes.filter((route) => [route.label, route.original, route.note].filter(Boolean).join(" ").toLowerCase().includes(needle));
  }, [section, search]);

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-5 py-6 text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600">Full app inspector</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Screen index</h1><p className="mt-1 text-sm text-slate-600">Inspect real product surfaces without leaving the selected mobile screen.</p></div><p className="text-xs text-slate-500">{routeCount} documented paths</p></div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <label className="text-xs font-semibold text-slate-500">Booking / job ID<input value={bookingId} onChange={(e) => setBookingId(e.target.value.trim())} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900" /></label>
        <label className="text-xs font-semibold text-slate-500">Provider ID<input value={providerId} onChange={(e) => setProviderId(e.target.value.trim())} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900" /></label>
        <label className="text-xs font-semibold text-slate-500">Application step<input value={step} onChange={(e) => setStep(e.target.value.trim())} placeholder="Optional slug" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900" /></label>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4"><AdminTabs value={kind} onChange={setKind} items={SECTIONS.map((entry) => ({ value: entry.kind, label: entry.title, count: entry.routes.length }))} /><AdminSearchField value={search} onChange={setSearch} placeholder={`Search ${section.title.toLowerCase()}…`} className="w-full max-w-sm" /></div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {visibleRoutes.length === 0 ? <p className="px-5 py-8 text-center text-sm text-slate-500">No routes match this search.</p> : visibleRoutes.map((route, index) => {
          const targetBase = route.preview ?? route.original;
          const target = substituteDynamic(targetBase, route.dynamic, bookingId, providerId, step);
          const isPreview = Boolean(route.preview);
          return <div key={route.original} className={`grid grid-cols-[minmax(260px,1.2fr)_minmax(260px,1fr)_150px] items-center gap-4 px-5 py-4 ${index > 0 ? "border-t border-slate-200" : ""}`}><div><p className="text-sm font-semibold text-slate-950">{route.label}</p>{route.note ? <p className="mt-1 text-xs leading-5 text-slate-500">{route.note}</p> : null}</div><code className="break-all text-xs text-slate-500">{route.original}</code><div className="text-right">{target ? <Link to={target} className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">{isPreview ? "Open preview" : "Open"}</Link> : <span className="text-xs text-slate-400">Add ID above</span>}</div></div>;
        })}
      </div>

      <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-950">Inspector boundary</summary><p className="border-t border-slate-200 px-4 py-3 text-xs leading-5 text-slate-600">This is visibility tooling, not impersonation. Screens use real supplied IDs; the inspector does not manufacture alternate product truth or elevate database permissions.</p></details>
    </main>
  );
}
