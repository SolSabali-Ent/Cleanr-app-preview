import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { adminTheme } from "../../theme/adminTheme";

type ProviderRow = {
  id: string;
  role: string;
  service_radius_miles: number | null;
};
type JobRow = {
  id: string;
  booking_id?: string;
  status: string;
  service_type: string;
  scheduled_start: string;
  price_cents: number;
  distance_meters: number;
  address: string | { zip?: string; postal_code?: string } | null;
};

type ProviderSuggestion = {
  provider_id: string;
  distance_meters: number;
  service_radius_miles: number;
};

export default function GeoHarness() {
  const [me, setMe] = useState<{ id: string } | null>(null);
  const [myProfile, setMyProfile] = useState<ProviderRow | null>(null);

  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");

  const [suggestions, setSuggestions] = useState<ProviderSuggestion[]>([]);
  const [dispatchResult, setDispatchResult] = useState<string>("");

  const [error, setError] = useState<string>("");

  const fmtMiles = (m: number) => (m / 1609.344).toFixed(2);

  useEffect(() => {
    (async () => {
      setError("");
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) return setError(userErr.message);
      if (!userData.user) return setError("Not signed in. Sign in as CSP or admin.");
      setMe({ id: userData.user.id });

      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("id, role, service_radius_miles")
        .eq("id", userData.user.id)
        .single();

      if (pErr) return setError(pErr.message);
      setMyProfile(profile as ProviderRow);
    })();
  }, []);

  const loadJobs = async () => {
    setError("");
    setDispatchResult("");
    if (!me?.id) return setError("No user session.");

    const { data, error } = await supabase.rpc("find_available_jobs_for_provider", {
      p_provider_id: me.id,
      p_limit: 100,
    });

    if (error) return setError(error.message);
    setJobs((data ?? []) as JobRow[]);
  };

  const loadSuggestions = async () => {
    setError("");
    setDispatchResult("");
    if (!selectedBookingId) return setError("Enter a booking id.");

    const { data, error } = await supabase.rpc("find_providers_for_booking", {
      p_booking_id: selectedBookingId,
      p_limit: 10,
    });

    if (error) return setError(error.message);
    setSuggestions((data ?? []) as ProviderSuggestion[]);
  };

  const dispatch = async () => {
    setError("");
    setDispatchResult("");
    if (!selectedBookingId) return setError("Enter a booking id.");

    const { data, error } = await supabase.rpc("auto_dispatch_booking", {
      p_booking_id: selectedBookingId,
    });

    if (error) return setError(error.message);
    setDispatchResult(`Assigned provider_id: ${String(data)}`);
    await loadJobs();
    await loadSuggestions();
  };

  const header = useMemo(() => {
    if (!me) return "Geo Harness (not signed in)";
    return `Geo Harness (user: ${me.id})`;
  }, [me]);

  return (
    <main className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>
        {header}
      </h1>

      {myProfile && (
        <div className="mt-3 mb-4 text-sm" style={{ color: adminTheme.textSecondary }}>
          <div>
            Role: <b>{myProfile.role}</b>
          </div>
          <div>
            Radius (mi): <b>{myProfile.service_radius_miles ?? "null"}</b>
          </div>
          <div style={{ fontSize: 12 }}>
            * Provider must have profiles.location set, and bookings must have bookings.location
            set, or matching returns 0.
          </div>
        </div>
      )}

      {error && (
        <div
          className="mb-3 rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: adminTheme.danger,
            background: "#FEF2F2",
            color: adminTheme.danger,
          }}
        >
          <b>Error:</b> {error}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={loadJobs}
          className="h-10 rounded-md px-3 text-sm font-medium text-white"
          style={{ backgroundColor: adminTheme.primary }}
        >
          Load Available Jobs Near Me
        </button>

        <input
          value={selectedBookingId}
          onChange={(e) => setSelectedBookingId(e.target.value)}
          placeholder="Booking ID to inspect/dispatch"
          className="h-10 min-w-[320px] rounded-md border px-3 text-sm"
          style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}
        />
        <button
          onClick={loadSuggestions}
          className="h-10 rounded-md px-3 text-sm font-medium text-white"
          style={{ backgroundColor: adminTheme.primary }}
        >
          Find Providers For Booking
        </button>
        <button
          onClick={dispatch}
          className="h-10 rounded-md px-3 text-sm font-medium text-white"
          style={{ backgroundColor: adminTheme.success }}
        >
          Auto-Dispatch Booking
        </button>
      </div>

      {dispatchResult && (
        <div
          className="mb-3 rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: adminTheme.success,
            background: "#F0FDF4",
            color: adminTheme.success,
          }}
        >
          {dispatchResult}
        </div>
      )}

      <h2 className="mt-6 text-lg font-semibold" style={{ color: adminTheme.textPrimary }}>
        Available Jobs
      </h2>
      <div
        className="mt-2 overflow-hidden rounded-xl border"
        style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: adminTheme.background }}>
            <tr>
              <th style={{ textAlign: "left", padding: 8 }}>Booking</th>
              <th style={{ textAlign: "left", padding: 8 }}>Status</th>
              <th style={{ textAlign: "left", padding: 8 }}>When</th>
              <th style={{ textAlign: "left", padding: 8 }}>Distance</th>
              <th style={{ textAlign: "left", padding: 8 }}>ZIP</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.id} style={{ borderTop: `1px solid ${adminTheme.border}` }}>
                <td style={{ padding: 8 }}>
                  <button
                    onClick={() => setSelectedBookingId(j.id)}
                    style={{ textAlign: "left", color: adminTheme.primary }}
                  >
                    {j.id}
                  </button>
                </td>
                <td style={{ padding: 8 }}>{j.status}</td>
                <td style={{ padding: 8 }}>{new Date(j.scheduled_start).toLocaleString()}</td>
                <td style={{ padding: 8 }}>
                  {Math.round(j.distance_meters)} m ({fmtMiles(j.distance_meters)} mi)
                </td>
                <td style={{ padding: 8 }}>
                  {typeof j.address === "object" && j.address
                    ? j.address?.zip ?? j.address?.postal_code ?? "—"
                    : "—"}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 12, opacity: 0.7 }}>
                  No jobs returned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mt-6 text-lg font-semibold" style={{ color: adminTheme.textPrimary }}>
        Provider Suggestions For Booking
      </h2>
      <div
        className="mt-2 overflow-hidden rounded-xl border"
        style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ background: adminTheme.background }}>
            <tr>
              <th style={{ textAlign: "left", padding: 8 }}>Provider</th>
              <th style={{ textAlign: "left", padding: 8 }}>Distance</th>
              <th style={{ textAlign: "left", padding: 8 }}>Radius (mi)</th>
            </tr>
          </thead>
          <tbody>
            {suggestions.map((s) => (
              <tr key={s.provider_id} style={{ borderTop: `1px solid ${adminTheme.border}` }}>
                <td style={{ padding: 8 }}>{s.provider_id}</td>
                <td style={{ padding: 8 }}>
                  {Math.round(s.distance_meters)} m ({fmtMiles(s.distance_meters)} mi)
                </td>
                <td style={{ padding: 8 }}>{s.service_radius_miles}</td>
              </tr>
            ))}
            {suggestions.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: 12, opacity: 0.7 }}>
                  No providers returned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
