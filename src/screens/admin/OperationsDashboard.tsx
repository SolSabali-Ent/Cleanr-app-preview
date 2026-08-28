import { type ReactNode, useEffect, useState } from "react";
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
  payout_approved_at: string | null;
  payout_released: boolean | null;
};

type ProviderOpsRow = {
  id: string;
  full_name: string | null;
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
  const [providers, setProviders] = useState<ProviderOpsRow[]>([]);
  const [bookingIdInput, setBookingIdInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === "admin";

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [b, p] = await Promise.all([
        supabase
          .from("bookings")
          .select(
            "id,status,customer_id,provider_id,check_in_at,check_out_at,payout_approved_at,payout_released"
          )
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("profiles")
          .select("id,full_name,marketplace_access,infrastructure_only")
          .eq("role", "csp")
          .order("updated_at", { ascending: false })
          .limit(30),
      ]);

      if (b.error) throw b.error;
      if (p.error) throw p.error;

      setBookings((b.data ?? []) as BookingAuditRow[]);
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

  const approvePayout = async () => {
    if (!bookingIdInput.trim()) {
      setMessage("Enter a booking id first.");
      return;
    }
    setMessage(null);
    const { error } = await supabase.rpc("admin_approve_payout", {
      p_booking_id: bookingIdInput.trim(),
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Payout approved. Release still requires Stripe transfer truth.");
    await load();
  };

  const toggleMarketplace = async (provider: ProviderOpsRow) => {
    setMessage(null);
    const { error } = await supabase.rpc("set_provider_marketplace_access", {
      p_provider_id: provider.id,
      p_enabled: !provider.marketplace_access,
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
          Booking audit, payout approvals, and marketplace controls.
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

      <Section title="Booking Audit & Payout Approval">
        <div className="flex flex-wrap gap-2">
          <input
            value={bookingIdInput}
            onChange={(e) => setBookingIdInput(e.target.value)}
            placeholder="Booking ID"
            className="h-[52px] min-w-[240px] flex-1 rounded-[12px] border px-4 text-sm"
            style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}
          />
          <button
            onClick={() => void approvePayout()}
            className="min-h-[52px] rounded-[14px] px-6 text-xs font-semibold text-white"
            style={{ backgroundColor: adminTheme.primary }}
          >
            Approve Payout
          </button>
        </div>

        <p className="mt-2 text-xs" style={{ color: adminTheme.textSecondary }}>
          Check-in and check-out are CSP service evidence and are not editable from this dashboard. Payout approval authorizes operations; release is shown only after Stripe transfer truth is recorded.
        </p>

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
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-4 text-sm text-slate-500">
                    Loading bookings…
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-sm text-slate-500">
                    No bookings found.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => {
                  const payoutState = b.payout_released
                    ? "released"
                    : b.payout_approved_at
                      ? "approved"
                      : "held";
                  return (
                    <tr key={b.id} className="border-t border-slate-200">
                      <td className="py-2">{b.id}</td>
                      <td>{b.status}</td>
                      <td>{b.check_in_at ?? "—"}</td>
                      <td>{b.check_out_at ?? "—"}</td>
                      <td>{payoutState}</td>
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Marketplace Access">
        <p className="mb-3 text-xs" style={{ color: adminTheme.textSecondary }}>
          Use marketplace access for legitimate eligibility, safety, or operational governance—not to control an ongoing customer–CSP relationship outside an active Cleanr booking.
        </p>
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{p.full_name ?? p.id}</p>
                  <p className="text-xs text-slate-500">
                    marketplace: {p.marketplace_access ? "enabled" : "disabled"} · infra-only:{" "}
                    {p.infrastructure_only ? "yes" : "no"}
                  </p>
                </div>
                <button
                  onClick={() => void toggleMarketplace(p)}
                  className="rounded-md px-2 py-1 text-xs text-white"
                  style={{ backgroundColor: adminTheme.primary }}
                >
                  Toggle Access
                </button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
