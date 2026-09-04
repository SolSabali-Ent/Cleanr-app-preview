import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useCspDashboardChrome } from "../../contexts/CspDashboardChromeContext";
import { adminTheme } from "../../theme/adminTheme";

type RouteKind = "public" | "customer" | "csp" | "growth" | "admin";

type RouteEntry = {
  label: string;
  original: string;
  preview?: string;
  note?: string;
  dynamic?: "booking" | "provider" | "job" | "step";
};

type RouteSection = {
  title: string;
  kind: RouteKind;
  routes: RouteEntry[];
};

const SECTIONS: RouteSection[] = [
  {
    title: "Public + booking entry",
    kind: "public",
    routes: [
      { label: "Landing", original: "/", preview: "/admin/full-app/public" },
      { label: "Customer sign in", original: "/signin", preview: "/admin/full-app/public/signin" },
      { label: "Role dashboard resolver", original: "/dashboard", note: "Redirect-only route; behavior depends on authenticated role/state." },
      { label: "Provider hub", original: "/csp", preview: "/admin/full-app/public/csp" },
      { label: "Founding Circle recruiting", original: "/csp/founding-circle", preview: "/admin/full-app/public/csp/founding-circle" },
      { label: "Provider sign in", original: "/csp/login", preview: "/admin/full-app/public/csp/login" },
      { label: "Provider sign up", original: "/csp/signup", preview: "/admin/full-app/public/csp/signup" },
      { label: "Booking flow", original: "/book", preview: "/admin/full-app/public/book" },
      { label: "Start booking alias", original: "/start-booking", note: "Redirect → /book" },
      { label: "Service alias", original: "/service", note: "Redirect → /book" },
      { label: "Booking confirmation", original: "/booking-confirmed", preview: "/admin/full-app/public/booking-confirmed" },
      { label: "Trust & Safety", original: "/trust-safety", preview: "/admin/full-app/public/trust-safety" },
      { label: "Legacy provider alias", original: "/provider", note: "Redirect → /csp/login" },
      { label: "Legacy onboarding alias", original: "/onboarding", note: "Redirect → /csp/dashboard" },
      { label: "CSP onboarding alias", original: "/csp/onboarding", note: "Redirect → /csp/dashboard" },
    ],
  },
  {
    title: "Customer app",
    kind: "customer",
    routes: [
      { label: "Customer home", original: "/app", preview: "/admin/full-app/customer" },
      { label: "Bookings / schedule", original: "/app/bookings", preview: "/admin/full-app/customer/bookings" },
      { label: "Booking details", original: "/app/bookings/:bookingId", preview: "/admin/full-app/customer/bookings/:bookingId", dynamic: "booking" },
      { label: "Before your cleaning", original: "/app/bookings/:bookingId/prep", preview: "/admin/full-app/customer/bookings/:bookingId/prep", dynamic: "booking" },
      { label: "Booking message", original: "/app/bookings/:bookingId/message", preview: "/admin/full-app/customer/bookings/:bookingId/message", dynamic: "booking" },
      { label: "Provider relationship overview", original: "/app/provider", preview: "/admin/full-app/customer/provider" },
      { label: "Provider list", original: "/app/provider/list", preview: "/admin/full-app/customer/provider/list" },
      { label: "Provider detail", original: "/app/provider/:providerId", preview: "/admin/full-app/customer/provider/:providerId", dynamic: "provider" },
      { label: "Customer profile", original: "/app/profile", preview: "/admin/full-app/customer/profile" },
      { label: "Payments", original: "/app/payments", preview: "/admin/full-app/customer/payments" },
      { label: "Service addresses", original: "/app/addresses", preview: "/admin/full-app/customer/addresses" },
      { label: "Help & safety", original: "/app/support", preview: "/admin/full-app/customer/support" },
      { label: "Urgent booking help", original: "/app/emergency", preview: "/admin/full-app/customer/emergency", note: "Legacy URL name retained for compatibility; product label is Urgent booking help." },
    ],
  },
  {
    title: "CSP setup + service dashboard",
    kind: "csp",
    routes: [
      { label: "Candidate readiness", original: "/csp/dashboard/candidate-readiness", preview: "/admin/full-app/csp/candidate-readiness" },
      { label: "Onboarding wizard", original: "/csp/dashboard/onboarding", preview: "/admin/full-app/csp/onboarding" },
      { label: "Verification", original: "/csp/dashboard/verification", preview: "/admin/full-app/csp/verification" },
      { label: "Application status", original: "/csp/dashboard/application-status", preview: "/admin/full-app/csp/application-status" },
      { label: "Terms", original: "/csp/dashboard/terms", preview: "/admin/full-app/csp/terms" },
      { label: "Application hub", original: "/csp/dashboard/application", preview: "/admin/full-app/csp/application" },
      { label: "Application step", original: "/csp/dashboard/application/:step", preview: "/admin/full-app/csp/application/:step", dynamic: "step", note: "Open a specific step slug from the application hub." },
      { label: "CSP home", original: "/csp/dashboard", preview: "/admin/full-app/csp" },
      { label: "Jobs", original: "/csp/dashboard/jobs", preview: "/admin/full-app/csp/jobs" },
      { label: "Job detail", original: "/csp/dashboard/jobs/:jobId", preview: "/admin/full-app/csp/jobs/:jobId", dynamic: "job" },
      { label: "Job message", original: "/csp/dashboard/jobs/:jobId/message", preview: "/admin/full-app/csp/jobs/:jobId/message", dynamic: "job" },
      { label: "Incident log", original: "/csp/dashboard/jobs/:jobId/incident", preview: "/admin/full-app/csp/jobs/:jobId/incident", dynamic: "job" },
      { label: "Calendar", original: "/csp/dashboard/calendar", preview: "/admin/full-app/csp/calendar" },
      { label: "Earnings", original: "/csp/dashboard/earnings", preview: "/admin/full-app/csp/earnings" },
      { label: "Existing clients", original: "/csp/dashboard/existing-clients", preview: "/admin/full-app/csp/existing-clients" },
      { label: "Availability legacy alias", original: "/csp/dashboard/availability", preview: "/admin/full-app/csp/availability", note: "Redirects to Calendar → Availability; retained for old links/bookmarks." },
      { label: "CSP profile", original: "/csp/dashboard/profile", preview: "/admin/full-app/csp/profile" },
    ],
  },
  {
    title: "Growth + Network",
    kind: "growth",
    routes: [
      { label: "Growth home", original: "/csp/growth", preview: "/admin/full-app/csp/growth" },
      { label: "Milestones", original: "/csp/growth/milestones", preview: "/admin/full-app/csp/growth/milestones" },
      { label: "Capabilities", original: "/csp/growth/capabilities", preview: "/admin/full-app/csp/growth/capabilities" },
      { label: "Opportunities", original: "/csp/growth/opportunities", preview: "/admin/full-app/csp/growth/opportunities" },
      { label: "Opportunity fit alias", original: "/csp/growth/fit", note: "Redirect → /csp/growth/opportunities" },
      { label: "Network", original: "/csp/growth/network", preview: "/admin/full-app/csp/growth/network" },
      { label: "Contributions", original: "/csp/growth/contributions", preview: "/admin/full-app/csp/growth/contributions" },
      { label: "Dashboard growth alias", original: "/csp/dashboard/growth", note: "Redirect → /csp/growth" },
      { label: "Dashboard milestones alias", original: "/csp/dashboard/growth/milestones", note: "Redirect → /csp/growth/milestones" },
      { label: "Dashboard capabilities alias", original: "/csp/dashboard/growth/capabilities", note: "Redirect → /csp/growth/capabilities" },
      { label: "Dashboard opportunities alias", original: "/csp/dashboard/growth/opportunities", note: "Redirect → /csp/growth/opportunities" },
      { label: "Dashboard opportunity fit alias", original: "/csp/dashboard/growth/opportunities/fit", note: "Redirect → /csp/growth/opportunities" },
      { label: "Dashboard network alias", original: "/csp/dashboard/growth/network", note: "Redirect → /csp/growth/network" },
      { label: "Dashboard contributions alias", original: "/csp/dashboard/growth/contributions", note: "Redirect → /csp/growth/contributions" },
    ],
  },
  {
    title: "Admin",
    kind: "admin",
    routes: [
      { label: "Admin root", original: "/admin", note: "Redirect → /admin/ops" },
      { label: "Operations", original: "/admin/ops" },
      { label: "Founding Circle", original: "/admin/founding-circle" },
      { label: "Providers", original: "/admin/providers" },
      { label: "Admin access", original: "/admin/access" },
      { label: "Geo harness", original: "/admin/geo" },
      { label: "Admin booking messages", original: "/admin/booking/:bookingId/messages", dynamic: "booking" },
      { label: "Super Admin", original: "/admin/full-app" },
    ],
  },
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
      <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Super Admin · product inspector</p>
          <p className="text-sm font-semibold text-slate-900">Every Cleanr surface, without customer/CSP route gates</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link to="/admin/full-app" className="rounded-md border border-slate-200 px-3 py-1.5 font-medium text-slate-700">Screen index</Link>
          <Link to="/admin/ops" className="rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white">Back to Ops</Link>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

export function AdminAppPreviewFrame() {
  const location = useLocation();
  const surface = location.pathname.includes("/customer")
    ? "Customer app"
    : location.pathname.includes("/csp")
      ? "CSP app"
      : "Public / booking";

  return (
    <main className="min-h-[calc(100vh-64px)] bg-slate-100 px-4 py-6">
      <div className="mx-auto w-full max-w-[430px]">
        <div className="mb-2 flex items-center justify-between px-1 text-xs font-medium text-slate-500">
          <span>Mobile preview · {surface}</span>
          <span>390 × 844</span>
        </div>
        <div
          className="admin-app-preview-frame relative mx-auto w-full max-w-[390px] overflow-y-auto overflow-x-hidden rounded-[32px] border-[10px] border-white bg-white shadow-xl ring-1 ring-slate-300"
          style={{ height: "min(844px, calc(100dvh - 150px))", minHeight: "560px" }}
        >
          <Outlet />
        </div>
        <p className="mt-3 px-2 text-center text-[11px] leading-4 text-slate-500">
          Route gates are bypassed for inspection. Database ownership, RLS, and real write permissions are not elevated by this preview.
        </p>
      </div>
    </main>
  );
}

export function AdminProviderPreviewOutlet() {
  const location = useLocation();
  const { setShowDashboardChrome } = useCspDashboardChrome();

  useLayoutEffect(() => {
    const p = location.pathname;
    const setup =
      p.includes("/candidate-readiness") ||
      p.includes("/onboarding") ||
      p.includes("/verification") ||
      p.includes("/application-status") ||
      p.includes("/terms") ||
      p.includes("/application");
    setShowDashboardChrome(!setup);
    return () => setShowDashboardChrome(false);
  }, [location.pathname, setShowDashboardChrome]);

  return <Outlet />;
}

export function AdminFullAppIndex() {
  const [bookingId, setBookingId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [step, setStep] = useState("");

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
    return () => {
      cancelled = true;
    };
  }, []);

  const routeCount = useMemo(() => SECTIONS.reduce((sum, section) => sum + section.routes.length, 0), []);
  const previewCount = useMemo(() => SECTIONS.reduce((sum, section) => sum + section.routes.filter((route) => route.preview).length, 0), []);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-6 text-slate-900">
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Super Admin screen inventory</p>
            <h1 className="mt-1 text-2xl font-bold">See the whole Cleanr app from Ops</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Every non-admin product screen opens in the same 390 × 844 app container so you can inspect the real customer, CSP, booking, Growth, and Network experiences without their normal route gates. Admin screens stay in the admin workspace.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold">{routeCount}</p>
              <p className="text-xs text-slate-500">documented paths</p>
            </div>
            <div className="rounded-xl bg-blue-50 px-4 py-3 text-center">
              <p className="text-2xl font-bold text-blue-700">{previewCount}</p>
              <p className="text-xs text-blue-600">app previews</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <label className="text-xs font-medium text-slate-600">
            Booking / job ID
            <input value={bookingId} onChange={(e) => setBookingId(e.target.value.trim())} placeholder="Auto-fills when a booking exists" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Provider ID
            <input value={providerId} onChange={(e) => setProviderId(e.target.value.trim())} placeholder="Auto-fills when a CSP exists" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Application step slug
            <input value={step} onChange={(e) => setStep(e.target.value.trim())} placeholder="Optional, from application hub" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900" />
          </label>
        </div>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.title} className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold">{section.title}</h2>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${section.kind === "admin" ? "bg-slate-100 text-slate-600" : "bg-blue-50 text-blue-700"}`}>
              {section.kind === "admin" ? "Admin workspace" : "App container"}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {section.routes.map((route) => {
              const targetBase = route.preview ?? route.original;
              const target = substituteDynamic(targetBase, route.dynamic, bookingId, providerId, step);
              const isPreview = Boolean(route.preview);
              return (
                <div key={`${section.title}:${route.original}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{route.label}</p>
                    <code className="mt-1 block break-all text-xs text-slate-500">{route.original}</code>
                    {route.note ? <p className="mt-1 text-xs text-slate-500">{route.note}</p> : null}
                    {isPreview ? <p className="mt-1 text-[11px] text-blue-600">Super Admin preview: {route.preview}</p> : null}
                  </div>
                  {target ? (
                    <Link to={target} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      {isPreview ? "Open preview" : section.kind === "admin" ? "Open admin" : "Open route"}
                    </Link>
                  ) : (
                    <span className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500">Add ID above</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <p className="pb-4 text-xs" style={{ color: adminTheme.textSecondary }}>
        This is visibility tooling, not impersonation. Screens that require a specific household, booking, CSP, or payment record use the real ID supplied above; Super Admin does not manufacture alternate product truth.
      </p>
    </main>
  );
}
