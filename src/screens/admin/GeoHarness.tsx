import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminStatus,
  AdminTableShell,
  AdminTabs,
} from "./AdminUi";

type ProviderRow = { id: string; role: string; service_radius_miles: number | null };
type JobRow = { id: string; booking_id?: string; status: string; service_type: string; scheduled_start: string; price_cents: number; distance_meters: number; address: string | { zip?: string; postal_code?: string } | null };
type ProviderSuggestion = { provider_id: string; distance_meters: number; service_radius_miles: number };
type View = "jobs" | "providers";

export default function GeoHarness() {
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [myProfile, setMyProfile] = useState<ProviderRow | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");
  const [suggestions, setSuggestions] = useState<ProviderSuggestion[]>([]);
  const [dispatchResult, setDispatchResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [view, setView] = useState<View>("jobs");
  const fmtMiles = (m: number) => (m / 1609.344).toFixed(2);

  useEffect(() => {
    void (async () => {
      setError("");
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) return setError(userErr.message);
      if (!userData.user) return setError("Not signed in. Sign in as CSP or admin.");
      setMe({ id: userData.user.id });
      const { data: profile, error: pErr } = await supabase.from("profiles").select("id, role, service_radius_miles").eq("id", userData.user.id).single();
      if (pErr) return setError(pErr.message);
      setMyProfile(profile as ProviderRow);
    })();
  }, []);

  const loadJobs = async () => {
    setError(""); setDispatchResult("");
    if (!me?.id) return setError("No user session.");
    const { data, error } = await supabase.rpc("find_available_jobs_for_provider", { p_provider_id: me.id, p_limit: 100 });
    if (error) return setError(error.message);
    setJobs((data ?? []) as JobRow[]); setView("jobs");
  };

  const loadSuggestions = async () => {
    setError(""); setDispatchResult("");
    if (!selectedBookingId) return setError("Enter a booking id.");
    const { data, error } = await supabase.rpc("find_providers_for_booking", { p_booking_id: selectedBookingId, p_limit: 10 });
    if (error) return setError(error.message);
    setSuggestions((data ?? []) as ProviderSuggestion[]); setView("providers");
  };

  const dispatch = async () => {
    setError(""); setDispatchResult("");
    if (!selectedBookingId) return setError("Enter a booking id.");
    if (!window.confirm("Run auto-dispatch for this booking? This invokes the real privileged assignment RPC.")) return;
    const { data, error } = await supabase.rpc("auto_dispatch_booking", { p_booking_id: selectedBookingId });
    if (error) return setError(error.message);
    setDispatchResult(`Assigned provider: ${String(data)}`);
    await Promise.all([loadJobs(), loadSuggestions()]);
  };

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        eyebrow="Tool"
        title="Geo harness"
        description="Inspect geographic eligibility and privileged dispatch behavior against real booking/provider location data."
        meta={myProfile ? <span className="text-xs text-slate-500">Session role {myProfile.role} · radius {myProfile.service_radius_miles ?? "—"} mi</span> : undefined}
      />

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}
      {dispatchResult ? <AdminNotice tone="success">{dispatchResult}</AdminNotice> : null}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4">
        <AdminSecondaryButton onClick={() => void loadJobs()}><RefreshCw className="h-4 w-4" /> Available jobs near session user</AdminSecondaryButton>
        <input value={selectedBookingId} onChange={(e) => setSelectedBookingId(e.target.value)} placeholder="Booking ID" className="min-h-10 min-w-[300px] flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400" />
        <AdminSecondaryButton onClick={() => void loadSuggestions()}>Find eligible providers</AdminSecondaryButton>
        <AdminPrimaryButton onClick={() => void dispatch()}>Auto-dispatch</AdminPrimaryButton>
      </div>

      <AdminTabs value={view} onChange={setView} items={[{ value: "jobs", label: "Available jobs", count: jobs.length }, { value: "providers", label: "Provider suggestions", count: suggestions.length }]} />

      {view === "jobs" ? (
        jobs.length === 0 ? <AdminEmptyState title="No jobs loaded" description="Run the nearby-jobs query to inspect geo eligibility for the current session user." /> : <AdminTableShell><div className="grid grid-cols-[minmax(240px,1.2fr)_150px_190px_160px_100px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><span>Booking</span><span>Status</span><span>When</span><span>Distance</span><span>ZIP</span></div>{jobs.map((job) => <div key={job.id} className="grid grid-cols-[minmax(240px,1.2fr)_150px_190px_160px_100px] items-center gap-4 border-b border-slate-200 px-5 py-4 text-xs last:border-b-0"><button type="button" onClick={() => setSelectedBookingId(job.id)} className="truncate text-left font-mono font-semibold text-[#0000FE] hover:underline">{job.id}</button><AdminStatus>{job.status.replaceAll("_", " ")}</AdminStatus><p className="text-slate-500">{new Date(job.scheduled_start).toLocaleString()}</p><p className="text-slate-600">{fmtMiles(job.distance_meters)} mi</p><p className="text-slate-500">{typeof job.address === "object" && job.address ? job.address.zip ?? job.address.postal_code ?? "—" : "—"}</p></div>)}</AdminTableShell>
      ) : (
        suggestions.length === 0 ? <AdminEmptyState title="No provider suggestions loaded" description="Enter a booking ID and run the provider-eligibility query." /> : <AdminTableShell><div className="grid grid-cols-[minmax(280px,1fr)_180px_180px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><span>Provider</span><span>Distance</span><span>Service radius</span></div>{suggestions.map((suggestion) => <div key={suggestion.provider_id} className="grid grid-cols-[minmax(280px,1fr)_180px_180px] gap-4 border-b border-slate-200 px-5 py-4 text-sm last:border-b-0"><p className="font-mono text-xs text-slate-700">{suggestion.provider_id}</p><p className="text-slate-600">{fmtMiles(suggestion.distance_meters)} mi</p><p className="text-slate-600">{suggestion.service_radius_miles} mi</p></div>)}</AdminTableShell>
      )}

      <details className="rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">Harness requirements</summary><p className="border-t border-slate-200 px-5 py-4 text-xs leading-5 text-slate-600">Provider profiles and bookings must both have valid location data or geo matching returns no results. Auto-dispatch invokes the real privileged assignment boundary; use it only with an intentional test booking.</p></details>
    </AdminPage>
  );
}
