import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useProfile } from "../../lib/useProfile";
import { adminTheme } from "../../theme/adminTheme";

type BookingAuditRow = {
  id: string;
  status: string;
  customer_id: string | null;
  provider_id: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  payout_released: boolean | null;
};

type DisputeRow = {
  id: string;
  booking_id: string;
  provider_id: string;
  status: "open" | "under_review" | "resolved";
  issue_type: string;
  created_at: string;
};

type InsuranceAlertRow = {
  provider_id: string;
  full_name: string | null;
  insurance_expires_at: string | null;
  insurance_status: "missing" | "expired" | "expiring_soon" | "valid";
};

type ProviderOpsRow = {
  id: string;
  full_name: string | null;
  diversion_warning_count: number;
  marketplace_access: boolean;
  infrastructure_only: boolean;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}
    >
      <h2 className="text-sm font-semibold" style={{ color: adminTheme.textPrimary }}>
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function OperationsDashboard() {
  const { profile } = useProfile();
  const [bookings, setBookings] = useState<BookingAuditRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [alerts, setAlerts] = useState<InsuranceAlertRow[]>([]);
  const [providers, setProviders] = useState<ProviderOpsRow[]>([]);
  const [bookingIdInput, setBookingIdInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin";

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [b, d, a, p] = await Promise.all([
        supabase
          .from("bookings")
          .select("id,status,customer_id,provider_id,check_in_at,check_out_at,payout_released")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("disputes")
          .select("id,booking_id,provider_id,status,issue_type,created_at")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("provider_insurance_expiration_alerts").select("*"),
        supabase
          .from("profiles")
          .select("id,full_name,diversion_warning_count,marketplace_access,infrastructure_only")
          .eq("role", "csp")
          .order("updated_at", { ascending: false })
          .limit(30),
      ]);

      if (b.error) throw b.error;
      if (d.error) throw d.error;
      if (a.error) throw a.error;
      if (p.error) throw p.error;

      setBookings((b.data ?? []) as BookingAuditRow[]);
      setDisputes((d.data ?? []) as DisputeRow[]);
      setAlerts((a.data ?? []) as InsuranceAlertRow[]);
      setProviders((p.data ?? []) as ProviderOpsRow[]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load admin dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin]);

  const openDisputes = useMemo(
    () => disputes.filter((d) => d.status === "open" || d.status === "under_review"),
    [disputes]
  );

  const runBookingAction = async (rpc: string) => {
    if (!bookingIdInput.trim()) {
      setMessage("Enter a booking id first.");
      return;
    }
    setMessage(null);
    const { error } = await supabase.rpc(rpc, { p_booking_id: bookingIdInput.trim() });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Success: ${rpc}`);
    await load();
  };

  const resolveDispute = async (disputeId: string, resolution: string) => {
    setMessage(null);
    const { error } = await supabase.rpc("admin_resolve_dispute", {
      p_dispute_id: disputeId,
      p_resolution: resolution,
      p_partial_refund_cents: null,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Resolved dispute ${disputeId} with ${resolution}`);
    await load();
  };

  const applyDiversionLevel = async (providerId: string, level: number) => {
    setMessage(null);
    const { error } = await supabase.rpc("admin_apply_diversion_action", {
      p_provider_id: providerId,
      p_level: level,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(`Applied diversion level ${level}`);
    await load();
  };

  const toggleMarketplace = async (provider: ProviderOpsRow) => {
    setMessage(null);
    const { error } = await supabase.rpc("admin_toggle_marketplace_access", {
      p_provider_id: provider.id,
      p_marketplace_access: !provider.marketplace_access,
      p_infrastructure_only: provider.infrastructure_only,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Marketplace access updated.");
    await load();
  };

  if (!profile) {
    return (
      <div className="text-sm" style={{ color: adminTheme.textSecondary }}>
        Loading admin session...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-sm" style={{ color: adminTheme.textSecondary }}>
        Admin access required.
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>
          Admin Operations
        </h1>
        <p className="mt-1 text-sm" style={{ color: adminTheme.textSecondary }}>
          Booking audit, disputes, insurance alerts, diversion actions, and payout controls.
        </p>
      </header>

      {message && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: adminTheme.border,
            backgroundColor: adminTheme.surface,
            color: adminTheme.textPrimary,
          }}
        >
          {message}
        </div>
      )}

        <Section title="Booking Audit View (Geo Logs)">
          <div className="flex gap-2">
            <input
              value={bookingIdInput}
              onChange={(e) => setBookingIdInput(e.target.value)}
              placeholder="Booking ID"
              className="h-[52px] flex-1 rounded-[12px] border px-4 text-sm"
              style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}
            />
            <button
              onClick={() => void runBookingAction("admin_override_check_in")}
              className="min-h-[52px] rounded-[14px] px-6 text-xs font-semibold text-white"
              style={{ backgroundColor: adminTheme.primary }}
            >
              Override Check-In
            </button>
            <button
              onClick={() => void runBookingAction("admin_override_check_out")}
              className="min-h-[52px] rounded-[14px] px-6 text-xs font-semibold text-white"
              style={{ backgroundColor: adminTheme.primary }}
            >
              Override Check-Out
            </button>
            <button
              onClick={() => void runBookingAction("admin_manual_release_payout")}
              className="min-h-[52px] rounded-[14px] px-6 text-xs font-semibold text-white"
              style={{ backgroundColor: adminTheme.primary }}
            >
              Manual Payout Release
            </button>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="py-2">Booking</th>
                  <th>Status</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Payout</th>
                  <th>Conversation</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-t border-slate-200">
                    <td className="py-2">{b.id}</td>
                    <td>{b.status}</td>
                    <td>{b.check_in_at ?? "—"}</td>
                    <td>{b.check_out_at ?? "—"}</td>
                    <td>{b.payout_released ? "released" : "held"}</td>
                    <td>
                      <Link
                        to={`/admin/booking/${b.id}/messages`}
                        className="text-xs underline"
                        style={{ color: adminTheme.primary }}
                      >
                        View messages
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Dispute Management">
          {loading ? (
            <p className="text-sm text-slate-500">Loading disputes…</p>
          ) : openDisputes.length === 0 ? (
            <p className="text-sm text-slate-500">No open disputes.</p>
          ) : (
            <div className="space-y-3">
              {openDisputes.map((d) => (
                <div key={d.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium">{d.booking_id}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {d.issue_type} · {d.status}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Link
                      to={`/admin/booking/${d.booking_id}/messages`}
                      className="text-xs underline"
                      style={{ color: adminTheme.primary }}
                    >
                      View messages
                    </Link>
                    {["full_payout", "partial_refund", "full_refund", "reservice_required"].map(
                      (r) => (
                        <button
                          key={r}
                          onClick={() => void resolveDispute(d.id, r)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          {r}
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Insurance Expiration Alerts">
          <div className="space-y-2 text-sm">
            {alerts.map((a) => (
              <div key={a.provider_id} className="rounded-lg border border-slate-200 p-2">
                <span className="font-medium">{a.full_name ?? a.provider_id}</span>
                <span className="ml-2 text-slate-500">{a.insurance_status}</span>
                <span className="ml-2 text-slate-500">{a.insurance_expires_at ?? "no expiration"}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Diversion Warning & Marketplace Access">
          <div className="space-y-3">
            {providers.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{p.full_name ?? p.id}</p>
                    <p className="text-xs text-slate-500">
                      warnings: {p.diversion_warning_count} · marketplace:{" "}
                      {p.marketplace_access ? "enabled" : "disabled"} · infra-only:{" "}
                      {p.infrastructure_only ? "yes" : "no"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => void applyDiversionLevel(p.id, 1)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      Level 1
                    </button>
                    <button
                      onClick={() => void applyDiversionLevel(p.id, 2)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      Level 2
                    </button>
                    <button
                      onClick={() => void applyDiversionLevel(p.id, 3)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      Level 3
                    </button>
                    <button
                      onClick={() => void toggleMarketplace(p)}
                      className="rounded-md px-2 py-1 text-xs text-white"
                      style={{ backgroundColor: adminTheme.primary }}
                    >
                      Toggle Access
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
    </main>
  );
}

