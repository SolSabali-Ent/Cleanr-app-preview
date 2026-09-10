import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useIsAdmin } from "../../lib/useIsAdmin";
import { KinexHandoffPanel } from "./KinexHandoffPanel";
import {
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminSectionHeader,
  AdminStatStrip,
  AdminStatus,
  AdminTableShell,
  AdminTextLink,
} from "./AdminUi";

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
  stripe_transfer_id: string | null;
};

type ProviderOpsRow = {
  id: string;
  full_name: string | null;
  marketplace_access: boolean;
  infrastructure_only: boolean;
  application_status: string | null;
  stripe_connect_ready: boolean;
  stripe_connect_account_id: string | null;
};

type RelationshipRow = { id: string; origin: string; status: string };
type NetworkRow = { status: string };
type NorthStarRow = { status: string };
type ContributionRow = { person_id: string };
type PayoutNotice = { tone: "info" | "warning" | "success"; text: string };

function providerCanActivateMarketplace(provider: ProviderOpsRow): boolean {
  return (
    (provider.application_status ?? "").toLowerCase() === "approved" &&
    provider.stripe_connect_ready === true &&
    Boolean(provider.stripe_connect_account_id?.trim())
  );
}

function payoutTone(row: BookingAuditRow) {
  if (row.payout_released) return "success" as const;
  if (row.payout_approved_at) return "info" as const;
  return "neutral" as const;
}

function payoutLabel(row: BookingAuditRow) {
  if (row.payout_released) return "Released";
  if (row.payout_approved_at) return "Approved";
  return "Held";
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
  const [payoutMessage, setPayoutMessage] = useState<PayoutNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutAction, setPayoutAction] = useState<"approve" | "release" | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);

    const [b, p, customers, admins, rels, ns, net, contrib] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,status,customer_id,provider_id,check_in_at,check_out_at,payout_approved_at,payout_released,stripe_payment_intent_id,stripe_transfer_id")
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("profiles")
        .select("id,full_name,marketplace_access,infrastructure_only,application_status,stripe_connect_ready,stripe_connect_account_id")
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
    const noteFailure = (label: string, error: { message: string } | null) => { if (error) failures.push(`${label}: ${error.message}`); };

    noteFailure("bookings", b.error); if (!b.error) setBookings((b.data ?? []) as BookingAuditRow[]);
    noteFailure("providers", p.error); if (!p.error) setProviders((p.data ?? []) as ProviderOpsRow[]);
    noteFailure("customers", customers.error); if (!customers.error) setCustomerCount(customers.count ?? 0);
    noteFailure("platform admins", admins.error); if (!admins.error) setAdminCount(admins.count ?? 0);
    noteFailure("service relationships", rels.error); if (!rels.error) setRelationships((rels.data ?? []) as RelationshipRow[]);
    noteFailure("North Stars", ns.error); if (!ns.error) setNorthStars((ns.data ?? []) as NorthStarRow[]);
    noteFailure("network relationships", net.error); if (!net.error) setNetwork((net.data ?? []) as NetworkRow[]);
    noteFailure("contributions", contrib.error); if (!contrib.error) setContributions((contrib.data ?? []) as ContributionRow[]);

    setMessage(failures.length > 0 ? `Some admin metrics could not load. ${failures.join(" · ")}` : null);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);

  const control = useMemo(() => {
    const paidBookings = bookings.filter((row) => Boolean(row.stripe_payment_intent_id)).length;
    const completedBookings = bookings.filter((row) => row.status === "completed_by_provider" || row.status === "confirmed").length;
    const payoutReleased = bookings.filter((row) => row.payout_released).length;
    const activeRelationships = relationships.filter((row) => row.status === "active").length;
    const providerBrought = relationships.filter((row) => row.origin === "provider_brought").length;
    const activeNetwork = network.filter((row) => row.status === "active").length;
    return { paidBookings, completedBookings, payoutReleased, activeRelationships, providerBrought, activeNetwork };
  }, [bookings, network, relationships]);

  const approvePayout = async () => {
    if (!bookingIdInput.trim()) return setPayoutMessage({ tone: "warning", text: "Enter a booking id first." });
    setPayoutMessage(null); setPayoutAction("approve");
    try {
      const { error } = await supabase.rpc("admin_approve_payout", { p_booking_id: bookingIdInput.trim() });
      if (error) return setPayoutMessage({ tone: "warning", text: error.message });
      await load();
      setPayoutMessage({ tone: "info", text: "Payout approved. Stripe transfer is still separate." });
    } finally { setPayoutAction(null); }
  };

  const releasePayout = async () => {
    if (!bookingIdInput.trim()) return setPayoutMessage({ tone: "warning", text: "Enter a booking id first." });
    setPayoutMessage(null); setPayoutAction("release");
    try {
      const { data, error } = await supabase.functions.invoke("release-provider-payout", { body: { booking_id: bookingIdInput.trim() } });
      if (error) return setPayoutMessage({ tone: "warning", text: error.message || "Stripe payout release failed." });
      const result = data as { error?: string; detail?: string; transfer_id?: string; already_released?: boolean } | null;
      if (result?.error) {
        return setPayoutMessage({
          tone: "warning",
          text: result.detail ? `${result.error}: ${result.detail}` : result.error,
        });
      }
      await load();
      setPayoutMessage({
        tone: "success",
        text: result?.already_released
          ? `Payout was already released${result.transfer_id ? ` · ${result.transfer_id}` : ""}.`
          : `Stripe payout released${result?.transfer_id ? ` · ${result.transfer_id}` : ""}.`,
      });
    } finally { setPayoutAction(null); }
  };

  const toggleMarketplace = async (provider: ProviderOpsRow) => {
    setMessage(null);
    if (!provider.marketplace_access && !providerCanActivateMarketplace(provider)) {
      setMessage("Marketplace activation is blocked until the application is approved and payout setup is complete.");
      return;
    }
    const { error } = await supabase.rpc("set_provider_marketplace_access", { p_provider_id: provider.id, p_enabled: !provider.marketplace_access });
    if (error) return setMessage(error.message);
    setMessage("Marketplace access updated.");
    await load();
  };

  if (adminLoading) return <p className="text-sm text-slate-500">Loading admin session…</p>;
  if (!isAdmin) return <p className="text-sm text-slate-500">Admin access required.</p>;

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        eyebrow="Control center"
        title="Operations"
        description="Service health, payouts, provider readiness, and the relationship assets created around the work."
        actions={
          <>
            <AdminTextLink to="/admin/founding-circle">Founding Circle</AdminTextLink>
            <Link to="/admin/full-app" className="inline-flex min-h-10 items-center rounded-lg bg-[#0000FE] px-3.5 py-2 text-xs font-semibold text-white">Open inspector</Link>
          </>
        }
      />

      {message ? <AdminNotice tone={message.startsWith("Some admin metrics") ? "warning" : "info"}>{message}</AdminNotice> : null}

      <AdminStatStrip
        items={[
          { label: "People", value: customerCount + providers.length, detail: `${customerCount} customers · ${providers.length} CSPs · ${adminCount} admins`, to: "/admin/csp-directory" },
          { label: "Bookings", value: bookings.length, detail: `${control.paidBookings} paid · ${control.completedBookings} completed`, to: "/admin/full-app" },
          { label: "Payouts released", value: control.payoutReleased, detail: "Stripe-backed releases" },
          { label: "Marketplace CSPs", value: providers.filter((row) => row.marketplace_access).length, detail: `${providers.length} CSP profiles`, to: "/admin/csp-directory" },
        ]}
      />

      <KinexHandoffPanel />

      <section>
        <AdminSectionHeader title="Relationship health" description="Assets that persist beyond the booking itself." />
        <div className="mt-3">
          <AdminStatStrip
            items={[
              { label: "Active relationships", value: control.activeRelationships, detail: `${control.providerBrought} provider-brought`, to: "/admin/founding-circle" },
              { label: "North Stars", value: northStars.length, detail: "Saved CSP direction", to: "/admin/full-app/csp/growth" },
              { label: "Network ties", value: control.activeNetwork, detail: "Active recorded connections", to: "/admin/full-app/csp/growth/network" },
              { label: "Impact records", value: contributions.length, detail: "Verified value returned", to: "/admin/full-app/csp/growth/contributions" },
            ]}
          />
        </div>
      </section>

      <section>
        <AdminSectionHeader title="Payout operations" description="Select a booking, approve the payout decision, then release through Stripe when eligible." />
        <AdminPanel className="mt-3">
          <div className="flex flex-wrap gap-2">
            <input
              value={bookingIdInput}
              onChange={(event) => {
                setBookingIdInput(event.target.value);
                setPayoutMessage(null);
              }}
              placeholder="Booking ID"
              className="min-h-10 min-w-[260px] flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
            />
            <AdminPrimaryButton disabled={payoutAction !== null} onClick={() => void approvePayout()}>{payoutAction === "approve" ? "Approving…" : "Approve payout"}</AdminPrimaryButton>
            <AdminSecondaryButton disabled={payoutAction !== null} onClick={() => void releasePayout()}>{payoutAction === "release" ? "Sending…" : "Send Stripe payout"}</AdminSecondaryButton>
          </div>
          {payoutMessage ? (
            <div className="mt-3">
              <AdminNotice tone={payoutMessage.tone}>{payoutMessage.text}</AdminNotice>
            </div>
          ) : null}
        </AdminPanel>

        <div className="mt-3">
          <AdminTableShell>
            <div className="grid grid-cols-[minmax(200px,1.2fr)_160px_150px_150px_160px_minmax(220px,1fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Booking</span><span>Status</span><span>Check-in</span><span>Check-out</span><span>Payout</span><span>Inspect</span>
            </div>
            {loading ? <p className="px-5 py-5 text-sm text-slate-500">Loading bookings…</p> : bookings.length === 0 ? <p className="px-5 py-5 text-sm text-slate-500">No bookings yet.</p> : bookings.slice(0, 20).map((booking) => (
              <div key={booking.id} className="grid grid-cols-[minmax(200px,1.2fr)_160px_150px_150px_160px_minmax(220px,1fr)] items-center gap-4 border-b border-slate-200 px-5 py-4 text-xs last:border-b-0">
                <button
                  type="button"
                  onClick={() => {
                    setBookingIdInput(booking.id);
                    setPayoutMessage(null);
                  }}
                  className="truncate text-left font-mono text-[#0000FE] hover:underline"
                  title="Use for payout actions"
                >
                  {booking.id}
                </button>
                <span className="capitalize text-slate-700">{booking.status.replaceAll("_", " ")}</span>
                <span className="text-slate-500">{booking.check_in_at ? new Date(booking.check_in_at).toLocaleString() : "—"}</span>
                <span className="text-slate-500">{booking.check_out_at ? new Date(booking.check_out_at).toLocaleString() : "—"}</span>
                <AdminStatus tone={payoutTone(booking)}>{payoutLabel(booking)}</AdminStatus>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <Link to={`/admin/booking/${booking.id}/messages`} className="text-[#0000FE] hover:underline">Messages</Link>
                  <Link to={`/admin/full-app/customer/bookings/${booking.id}`} className="text-[#0000FE] hover:underline">Customer</Link>
                  <Link to={`/admin/full-app/csp/jobs/${booking.id}`} className="text-[#0000FE] hover:underline">CSP</Link>
                </div>
              </div>
            ))}
          </AdminTableShell>
        </div>
      </section>

      <section>
        <AdminSectionHeader title="Marketplace access" description="Approved providers can be activated only after payout setup is ready." actions={<AdminTextLink to="/admin/providers">Open applications</AdminTextLink>} />
        <AdminTableShell>
          {providers.length === 0 ? <p className="px-5 py-5 text-sm text-slate-500">No CSP profiles found.</p> : providers.map((provider, index) => {
            const activationReady = providerCanActivateMarketplace(provider);
            const canToggle = provider.marketplace_access || activationReady;
            return (
              <div key={provider.id} className={`grid grid-cols-[minmax(260px,1fr)_180px_180px_210px] items-center gap-4 px-5 py-4 ${index > 0 ? "border-t border-slate-200" : ""}`}>
                <div>
                  <p className="text-sm font-semibold text-slate-950">{provider.full_name ?? provider.id}</p>
                  <p className="mt-1 text-xs text-slate-500">{provider.infrastructure_only ? "Infrastructure only" : "Marketplace-capable profile"}</p>
                </div>
                <AdminStatus tone={(provider.application_status ?? "").toLowerCase() === "approved" ? "success" : "neutral"}>{provider.application_status ?? "Not submitted"}</AdminStatus>
                <AdminStatus tone={provider.stripe_connect_ready && provider.stripe_connect_account_id?.trim() ? "success" : "warning"}>{provider.stripe_connect_ready && provider.stripe_connect_account_id?.trim() ? "Payout ready" : "Payout setup needed"}</AdminStatus>
                <div className="text-right">
                  <AdminSecondaryButton disabled={!canToggle} onClick={() => void toggleMarketplace(provider)}>
                    {provider.marketplace_access ? "Disable marketplace" : activationReady ? "Enable marketplace" : "Not ready"}
                  </AdminSecondaryButton>
                </div>
              </div>
            );
          })}
        </AdminTableShell>
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">What this dashboard measures</summary>
        <p className="border-t border-slate-200 px-5 py-4 text-xs leading-5 text-slate-600">
          Operational health is only one side of the model. Cleanr also tracks whether service creates durable relationships, agency, network density, and value that can create future opportunity.
        </p>
      </details>
    </AdminPage>
  );
}
