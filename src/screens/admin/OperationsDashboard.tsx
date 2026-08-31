import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useIsAdmin } from "../../lib/useIsAdmin";
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
  stripe_payment_intent_id: string | null;
};

type ProviderOpsRow = {
  id: string;
  full_name: string | null;
  marketplace_access: boolean;
  infrastructure_only: boolean;
};

type RelationshipRow = {
  id: string;
  origin: string;
  status: string;
};

type NetworkRow = { status: string };
type NorthStarRow = { status: string };
type ContributionRow = { person_id: string };

type ControlMetricProps = {
  label: string;
  value: string | number;
  detail: string;
  to?: string;
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

function ControlMetric({ label, value, detail, to }: ControlMetricProps) {
  const body = (
    <div
      className="h-full rounded-xl border p-4 transition-colors"
      style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}
    >
      <p className="text-xs font-medium" style={{ color: adminTheme.textSecondary }}>{label}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>{value}</p>
      <p className="mt-1 text-xs leading-5" style={{ color: adminTheme.textSecondary }}>{detail}</p>
    </div>
  );

  return to ? <Link to={to} className="block h-full">{body}</Link> : body;
}

export function OperationsDashboard() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [bookings, setBookings] = useState<BookingAuditRow[]>([]);
  const [providers, setProviders] = useState<ProviderOpsRow[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [northStars, setNorthStars] = useState<NorthStarRow[]>([]);
  const [network, setNetwork] = useState<NetworkRow[]>([]);
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [bookingIdInput, setBookingIdInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setMessage(null);

    const [b, p, customers, admins, rels, ns, net, contrib] = await Promise.all([
      supabase
        .from("bookings")
        .select(
          "id,status,customer_id,provider_id,check_in_at,check_out_at,payout_approved_at,payout_released,stripe_payment_intent_id"
        )
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("profiles")
        .select("id,full_name,marketplace_access,infrastructure_only")
        .eq("role", "csp")
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer"),
      supabase.from("platform_admin_memberships").select("user_id", { count: "exact", head: true }),
      supabase.from("service_relationships").select("id,origin,status"),
      supabase.from("north_stars").select("status"),
      supabase.from("network_relationships").select("status"),
      supabase.from("contributions").select("person_id"),
    ]);

    const failures: string[] = [];
    const noteFailure = (label: string, error: { message: string } | null) => {
      if (error) failures.push(`${label}: ${error.message}`);
    };

    noteFailure("bookings", b.error);
    if (!b.error) setBookings((b.data ?? []) as BookingAuditRow[]);

    noteFailure("providers", p.error);
    if (!p.error) setProviders((p.data ?? []) as ProviderOpsRow[]);

    noteFailure("customers", customers.error);
    if (!customers.error) setCustomerCount(customers.count ?? 0);

    noteFailure("platform admins", admins.error);
    if (!admins.error) setAdminCount(admins.count ?? 0);

    noteFailure("service relationships", rels.error);
    if (!rels.error) setRelationships((rels.data ?? []) as RelationshipRow[]);

    noteFailure("North Stars", ns.error);
    if (!ns.error) setNorthStars((ns.data ?? []) as NorthStarRow[]);

    noteFailure("network relationships", net.error);
    if (!net.error) setNetwork((net.data ?? []) as NetworkRow[]);

    noteFailure("contributions", contrib.error);
    if (!contrib.error) setContributions((contrib.data ?? []) as ContributionRow[]);

    setMessage(
      failures.length > 0
        ? `Some admin metrics could not load. ${failures.join(" · ")}`
        : null
    );
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin]);

  const control = useMemo(() => {
    const paidBookings = bookings.filter((row) => Boolean(row.stripe_payment_intent_id)).length;
    const completedBookings = bookings.filter((row) => row.status === "completed_by_provider" || row.status === "confirmed").length;
    const payoutReleased = bookings.filter((row) => row.payout_released).length;
    const activeRelationships = relationships.filter((row) => row.status === "active").length;
    const providerBrought = relationships.filter((row) => row.origin === "provider_brought").length;
    const activeNetwork = network.filter((row) => row.status === "active").length;

    return {
      paidBookings,
      completedBookings,
      payoutReleased,
      activeRelationships,
      providerBrought,
      activeNetwork,
    };
  }, [bookings, network, relationships]);

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

  if (adminLoading) {
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
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: adminTheme.primary }}>
            Cleanr control center
          </p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>
            Operations + Collective Capacity
          </h1>
          <p className="mt-1 max-w-3xl text-sm" style={{ color: adminTheme.textSecondary }}>
            Service-engine truth beside the durable assets Cleanr is trying to create: relationships, agency, network density, and contribution.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/founding-circle"
            className="rounded-lg border px-3 py-2 text-xs font-semibold"
            style={{ borderColor: adminTheme.border, color: adminTheme.textPrimary }}
          >
            Founding Circle
          </Link>
          <Link
            to="/admin/full-app"
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: adminTheme.primary }}
          >
            Full App
          </Link>
        </div>
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

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: adminTheme.textPrimary }}>Service engine</h2>
            <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>
              Are people entering, booking, completing, and getting paid through the residential engine?
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ControlMetric label="People" value={customerCount + providers.length} detail={`${customerCount} customers · ${providers.length} CSPs · ${adminCount} platform admins`} to="/admin/providers" />
          <ControlMetric label="Bookings" value={bookings.length} detail={`${control.paidBookings} paid · ${control.completedBookings} completed`} to="/admin/full-app" />
          <ControlMetric label="Payouts released" value={control.payoutReleased} detail="Stripe-backed payout truth, not approval alone" />
          <ControlMetric label="Marketplace-enabled CSPs" value={providers.filter((row) => row.marketplace_access).length} detail={`${providers.length} total CSP profiles`} to="/admin/providers" />
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold" style={{ color: adminTheme.textPrimary }}>Relationship + collective capacity</h2>
          <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>
            What remains after the transaction—and what people can increasingly do together because Cleanr exists.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <ControlMetric label="Active relationships" value={control.activeRelationships} detail={`${control.providerBrought} provider-brought`} to="/admin/founding-circle" />
          <ControlMetric label="North Stars" value={northStars.length} detail="Persistent person-level direction and agency" to="/admin/full-app/csp/growth/milestones" />
          <ControlMetric label="Active network ties" value={control.activeNetwork} detail="Recorded relationship density across the network" to="/admin/full-app/csp/growth/network" />
          <ControlMetric label="Contributions" value={contributions.length} detail="Value deliberately returned to another person or the collective" to="/admin/full-app/csp/growth/contributions" />
          <ControlMetric label="Collective assets" value={control.activeRelationships + northStars.length + control.activeNetwork + contributions.length} detail="Directional count; not a financial valuation" to="/admin/founding-circle" />
        </div>
      </section>

      <section
        className="rounded-xl border p-4"
        style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: adminTheme.textPrimary }}>Transformation test</p>
            <p className="mt-1 max-w-4xl text-xs leading-5" style={{ color: adminTheme.textSecondary }}>
              Use this dashboard to ask whether growth strengthens human relationships, leaves a durable asset, increases what people can create collectively, expands agency, and lets value circulate into new opportunity—not merely whether booking volume rises.
            </p>
          </div>
          <Link to="/admin/full-app" className="text-xs font-semibold underline" style={{ color: adminTheme.primary }}>
            Inspect the product surfaces →
          </Link>
        </div>
      </section>

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
                <th>Inspect</th>
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
                    No bookings found yet. The pilot baseline is clean.
                  </td>
                </tr>
              ) : (
                bookings.slice(0, 20).map((b) => {
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
                        <div className="flex flex-wrap gap-2">
                          <Link
                            to={`/admin/booking/${b.id}/messages`}
                            className="text-xs underline"
                            style={{ color: adminTheme.primary }}
                          >
                            messages
                          </Link>
                          <Link
                            to={`/admin/full-app/customer/bookings/${b.id}`}
                            className="text-xs underline"
                            style={{ color: adminTheme.primary }}
                          >
                            customer view
                          </Link>
                          <Link
                            to={`/admin/full-app/csp/jobs/${b.id}`}
                            className="text-xs underline"
                            style={{ color: adminTheme.primary }}
                          >
                            CSP view
                          </Link>
                        </div>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-3xl text-xs" style={{ color: adminTheme.textSecondary }}>
            Use marketplace access for legitimate eligibility, safety, or operational governance—not to control an ongoing customer–CSP relationship outside an active Cleanr booking.
          </p>
          <Link to="/admin/providers" className="text-xs font-semibold underline" style={{ color: adminTheme.primary }}>
            Open provider review →
          </Link>
        </div>
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
