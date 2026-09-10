import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useIsAdmin } from "../../lib/useIsAdmin";
import {
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  AdminSectionHeader,
  AdminStatStrip,
  AdminStatus,
  AdminTableShell,
  AdminTextLink,
} from "./AdminUi";

type ExceptionType = "missed_visit_open" | "payment_review" | "accepted_missing_verified_address";

type ExceptionRow = {
  exception_type: ExceptionType;
  booking_id: string;
  customer_id: string | null;
  provider_id: string | null;
  scheduled_start: string;
  due_at: string | null;
  service_type: string;
  address_display: string;
  amount_cents: number;
};

function exceptionLabel(type: ExceptionType): string {
  if (type === "missed_visit_open") return "Missed visit open";
  if (type === "payment_review") return "Payment review";
  return "Address issue";
}

function exceptionTone(type: ExceptionType) {
  if (type === "payment_review") return "warning" as const;
  if (type === "accepted_missing_verified_address") return "danger" as const;
  return "info" as const;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function AdminBookingExceptions() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_booking_exception_queue");
    if (rpcError) {
      setRows([]);
      setError(rpcError.message);
    } else {
      setRows((data ?? []) as ExceptionRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const counts = useMemo(() => ({
    openMissed: rows.filter((row) => row.exception_type === "missed_visit_open").length,
    payment: rows.filter((row) => row.exception_type === "payment_review").length,
    address: rows.filter((row) => row.exception_type === "accepted_missing_verified_address").length,
  }), [rows]);

  if (adminLoading) return <p className="text-sm text-slate-500">Loading admin session…</p>;
  if (!isAdmin) return <p className="text-sm text-slate-500">Admin access required.</p>;

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        eyebrow="Operations"
        title="Booking exceptions"
        description="Paid or accepted visits that need a human eye so service, scheduling, payment, and address truth do not drift apart."
        actions={<AdminTextLink to="/admin/missed-visit-payments">Open missed payments</AdminTextLink>}
      />

      {error ? <AdminNotice tone="warning">Exception queue could not load. {error}</AdminNotice> : null}

      <AdminStatStrip
        items={[
          { label: "Open missed visits", value: counts.openMissed, detail: "Still inside the recovery window" },
          { label: "Payment reviews", value: counts.payment, detail: "Service closed; money still needs review", to: "/admin/missed-visit-payments" },
          { label: "Address issues", value: counts.address, detail: "Accepted without a verified street address" },
          { label: "Total exceptions", value: rows.length, detail: "One booking can appear in more than one lane" },
        ]}
      />

      <section>
        <AdminSectionHeader title="Exception queue" description="The queue preserves the difference between what happened to the visit and what still needs to happen operationally." />
        <AdminPanel className="mt-3 p-0">
          <AdminTableShell>
            <div className="grid grid-cols-[170px_minmax(220px,1fr)_170px_180px_130px_minmax(190px,0.8fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Issue</span><span>Visit</span><span>Scheduled</span><span>Resolve / review by</span><span>Amount</span><span>Inspect</span>
            </div>
            {loading ? (
              <p className="px-5 py-5 text-sm text-slate-500">Loading exceptions…</p>
            ) : rows.length === 0 ? (
              <p className="px-5 py-5 text-sm text-slate-500">No booking exceptions right now.</p>
            ) : rows.map((row) => (
              <div key={`${row.exception_type}:${row.booking_id}`} className="grid grid-cols-[170px_minmax(220px,1fr)_170px_180px_130px_minmax(190px,0.8fr)] items-center gap-4 border-b border-slate-200 px-5 py-4 text-xs last:border-b-0">
                <AdminStatus tone={exceptionTone(row.exception_type)}>{exceptionLabel(row.exception_type)}</AdminStatus>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950">{row.service_type}</p>
                  <p className="mt-1 truncate text-slate-500" title={row.address_display}>{row.address_display}</p>
                  <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{row.booking_id}</p>
                </div>
                <span className="text-slate-600">{formatDateTime(row.scheduled_start)}</span>
                <span className="text-slate-600">{formatDateTime(row.due_at)}</span>
                <span className="font-semibold text-slate-900">${(Number(row.amount_cents ?? 0) / 100).toFixed(0)}</span>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <Link to={`/admin/full-app/customer/bookings/${row.booking_id}`} className="text-[#0000FE] hover:underline">Customer</Link>
                  {row.provider_id ? <Link to={`/admin/full-app/csp/jobs/${row.booking_id}`} className="text-[#0000FE] hover:underline">CSP</Link> : null}
                  <Link to={`/admin/booking/${row.booking_id}/messages`} className="text-[#0000FE] hover:underline">Messages</Link>
                  {row.exception_type === "payment_review" ? <Link to="/admin/missed-visit-payments" className="text-[#0000FE] hover:underline">Payment</Link> : null}
                </div>
              </div>
            ))}
          </AdminTableShell>
        </AdminPanel>
      </section>

      <AdminNotice tone="info">
        A closed missed visit is not marked completed. A payment review does not rewrite service history. Address issues remain visible until the underlying booking truth is repaired.
      </AdminNotice>
    </AdminPage>
  );
}
