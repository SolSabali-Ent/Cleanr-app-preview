import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
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
} from "./AdminUi";

type ReviewRow = {
  booking_id: string;
  customer_id: string;
  customer_name: string;
  provider_id: string | null;
  provider_name: string;
  scheduled_start: string;
  service_timezone: string;
  price_cents: number;
  customer_payment_cents: number;
  refunded_amount_cents: number;
  net_payment_cents: number;
  recurring_plan_id: string | null;
  missed_visit_resolved_at: string | null;
  resolution: string | null;
  resolution_note: string | null;
};

type Resolution = "refund_recorded" | "credit_recorded" | "no_adjustment_needed";

function money(cents: number | null | undefined): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function AdminMissedVisitPaymentReviews() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_missed_visit_payment_reviews");
    if (rpcError) {
      setError(rpcError.message);
      setRows([]);
    } else {
      setRows((data ?? []) as ReviewRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function resolve(row: ReviewRow, resolution: Resolution) {
    if (busyId) return;
    const note = (notes[row.booking_id] ?? "").trim();
    if (note.length < 10) {
      setError("Add a resolution note of at least 10 characters before closing this review.");
      return;
    }

    setBusyId(row.booking_id);
    setError(null);
    setNotice(null);
    const { error: rpcError } = await supabase.rpc("admin_resolve_missed_visit_payment_review", {
      p_booking_id: row.booking_id,
      p_resolution: resolution,
      p_note: note,
    });
    setBusyId(null);

    if (rpcError) {
      const friendly = rpcError.message.includes("full_refund_not_recorded")
        ? "Refund evidence is not complete yet. Record the full Stripe refund before marking this resolved."
        : rpcError.message.includes("sufficient_customer_credit_not_recorded")
          ? "Enough customer credit has not been recorded for this booking yet. Add the credit before resolving as credited."
          : rpcError.message;
      setError(friendly);
      return;
    }

    setNotice("Payment review resolved.");
    setNotes((current) => ({ ...current, [row.booking_id]: "" }));
    await load();
  }

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        eyebrow="Booking operations"
        title="Missed visit payments"
        description="Resolve the money side of paid visits that were closed without rescheduling."
        meta={<span className="text-xs text-slate-500">{loading ? "Loading…" : `${rows.length} open review${rows.length === 1 ? "" : "s"}`}</span>}
        actions={<AdminSecondaryButton disabled={loading} onClick={() => void load()}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</AdminSecondaryButton>}
      />

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}
      {notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}

      {!loading && rows.length === 0 ? (
        <AdminEmptyState title="No payment reviews are open" description="Paid missed visits will appear here only when an explicit financial disposition is still needed." />
      ) : null}

      {rows.length > 0 ? (
        <AdminTableShell>
          <div className="grid grid-cols-[minmax(220px,1.2fr)_190px_130px_130px_130px_minmax(280px,1.4fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Visit</span><span>Provider</span><span>Paid</span><span>Refunded</span><span>Net</span><span>Decision</span>
          </div>
          {rows.map((row) => (
            <div key={row.booking_id} className="grid grid-cols-[minmax(220px,1.2fr)_190px_130px_130px_130px_minmax(280px,1.4fr)] gap-4 border-b border-slate-200 px-5 py-5 last:border-b-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-950">{row.customer_name}</p>
                  <AdminStatus tone="warning">Review</AdminStatus>
                  {row.recurring_plan_id ? <AdminStatus tone="success">Recurring</AdminStatus> : null}
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatWhen(row.scheduled_start)}</p>
                <Link to={`/admin/full-app/customer/bookings/${row.booking_id}`} className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0000FE] hover:underline">
                  Inspect booking <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <p className="text-sm text-slate-700">{row.provider_name}</p>
              <p className="text-sm font-semibold text-slate-950">{money(row.customer_payment_cents)}</p>
              <p className="text-sm font-semibold text-slate-950">{money(row.refunded_amount_cents)}</p>
              <p className="text-sm font-semibold text-slate-950">{money(row.net_payment_cents)}</p>

              <div>
                <textarea
                  value={notes[row.booking_id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [row.booking_id]: event.target.value }))}
                  placeholder="Resolution note"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <AdminSecondaryButton disabled={busyId === row.booking_id} onClick={() => void resolve(row, "refund_recorded")}>Refund</AdminSecondaryButton>
                  <AdminSecondaryButton disabled={busyId === row.booking_id} onClick={() => void resolve(row, "credit_recorded")}>Credit</AdminSecondaryButton>
                  <AdminPrimaryButton disabled={busyId === row.booking_id} onClick={() => void resolve(row, "no_adjustment_needed")}>No adjustment</AdminPrimaryButton>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Refund and credit outcomes remain evidence-gated.</p>
              </div>
            </div>
          ))}
        </AdminTableShell>
      ) : null}
    </AdminPage>
  );
}
