import { useCallback, useEffect, useMemo, useState } from "react";
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
  AdminSectionHeader,
  AdminStatStrip,
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

function exceptionLabel(type: ExceptionType): string {
  if (type === "missed_visit_open") return "Missed visit open";
  if (type === "payment_review") return "Payment review";
  return "Address issue";
}

function exceptionTone(type: ExceptionType) {
  if (type === "accepted_missing_verified_address") return "danger" as const;
  if (type === "payment_review") return "warning" as const;
  return "info" as const;
}

export function AdminMissedVisitPaymentReviews() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [reviewResult, exceptionResult] = await Promise.all([
      supabase.rpc("get_admin_missed_visit_payment_reviews"),
      supabase.rpc("get_admin_booking_exception_queue"),
    ]);

    const failures: string[] = [];
    if (reviewResult.error) {
      failures.push(reviewResult.error.message);
      setRows([]);
    } else {
      setRows((reviewResult.data ?? []) as ReviewRow[]);
    }

    if (exceptionResult.error) {
      failures.push(exceptionResult.error.message);
      setExceptions([]);
    } else {
      setExceptions((exceptionResult.data ?? []) as ExceptionRow[]);
    }

    if (failures.length > 0) setError(failures.join(" · "));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const exceptionCounts = useMemo(() => ({
    missed: exceptions.filter((row) => row.exception_type === "missed_visit_open").length,
    payment: exceptions.filter((row) => row.exception_type === "payment_review").length,
    address: exceptions.filter((row) => row.exception_type === "accepted_missing_verified_address").length,
  }), [exceptions]);

  const schedulingExceptions = useMemo(
    () => exceptions.filter((row) => row.exception_type !== "payment_review"),
    [exceptions]
  );

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
        title="Booking exceptions"
        description="Keep service, scheduling, payment, and address truth aligned when a visit does not follow the normal path."
        meta={<span className="text-xs text-slate-500">{loading ? "Loading…" : `${exceptions.length} open exception${exceptions.length === 1 ? "" : "s"}`}</span>}
        actions={<AdminSecondaryButton disabled={loading} onClick={() => void load()}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</AdminSecondaryButton>}
      />

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}
      {notice ? <AdminNotice tone="success">{notice}</AdminNotice> : null}

      <AdminStatStrip
        items={[
          { label: "Open missed visits", value: exceptionCounts.missed, detail: "Inside the recovery window" },
          { label: "Payment reviews", value: exceptionCounts.payment, detail: "Scheduling is closed; money still needs review" },
          { label: "Address issues", value: exceptionCounts.address, detail: "Accepted without verified street address" },
          { label: "All exceptions", value: exceptions.length, detail: "One booking may appear in more than one lane" },
        ]}
      />

      <section>
        <AdminSectionHeader title="Scheduling and address exceptions" description="These need attention before they can disappear from normal operational focus." />
        <div className="mt-3">
          {loading ? (
            <AdminTableShell><p className="px-5 py-5 text-sm text-slate-500">Loading exceptions…</p></AdminTableShell>
          ) : schedulingExceptions.length === 0 ? (
            <AdminEmptyState title="No scheduling or address exceptions" description="Missed visits and accepted bookings without verified addresses will surface here." />
          ) : (
            <AdminTableShell>
              <div className="grid grid-cols-[130px_minmax(210px,1fr)_145px_145px_100px_minmax(165px,0.8fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span>Issue</span><span>Visit</span><span>Scheduled</span><span>Resolve by</span><span>Amount</span><span>Inspect</span>
              </div>
              {schedulingExceptions.map((row) => (
                <div key={`${row.exception_type}:${row.booking_id}`} className="grid grid-cols-[130px_minmax(210px,1fr)_145px_145px_100px_minmax(165px,0.8fr)] items-center gap-4 border-b border-slate-200 px-5 py-4 text-xs last:border-b-0">
                  <AdminStatus tone={exceptionTone(row.exception_type)}>{exceptionLabel(row.exception_type)}</AdminStatus>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{row.service_type}</p>
                    <p className="mt-1 truncate text-slate-500" title={row.address_display}>{row.address_display}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{row.booking_id}</p>
                  </div>
                  <span className="text-slate-600">{formatWhen(row.scheduled_start)}</span>
                  <span className="text-slate-600">{formatWhen(row.due_at)}</span>
                  <span className="font-semibold text-slate-950">{money(row.amount_cents)}</span>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <Link to={`/admin/full-app/customer/bookings/${row.booking_id}`} className="text-[#0000FE] hover:underline">Customer</Link>
                    {row.provider_id ? <Link to={`/admin/full-app/csp/jobs/${row.booking_id}`} className="text-[#0000FE] hover:underline">CSP</Link> : null}
                    <Link to={`/admin/booking/${row.booking_id}/messages`} className="text-[#0000FE] hover:underline">Messages</Link>
                  </div>
                </div>
              ))}
            </AdminTableShell>
          )}
        </div>
      </section>

      <section>
        <AdminSectionHeader title="Missed visit payment reviews" description="A missed visit can be closed operationally without pretending service happened. The money side stays open until there is evidence for the final outcome." />
        <div className="mt-3">
          {!loading && rows.length === 0 ? (
            <AdminEmptyState title="No payment reviews are open" description="Paid missed visits appear here only when an explicit financial disposition is still needed." />
          ) : null}

          {rows.length > 0 ? (
            <AdminTableShell>
              <div className="grid grid-cols-[minmax(185px,1.1fr)_120px_90px_90px_90px_minmax(290px,1.45fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span>Visit</span><span>Provider</span><span>Paid</span><span>Refunded</span><span>Net</span><span>Decision</span>
              </div>
              {rows.map((row) => (
                <div key={row.booking_id} className="grid grid-cols-[minmax(185px,1.1fr)_120px_90px_90px_90px_minmax(290px,1.45fr)] gap-4 border-b border-slate-200 px-5 py-5 last:border-b-0">
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

                  <div className="min-w-0">
                    <textarea
                      value={notes[row.booking_id] ?? ""}
                      onChange={(event) => setNotes((current) => ({ ...current, [row.booking_id]: event.target.value }))}
                      placeholder="Resolution note"
                      rows={2}
                      className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                    />
                    <div className="mt-2 grid grid-cols-3 gap-2">
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
        </div>
      </section>

      <AdminNotice tone="info">A closed missed visit is not marked completed, and a payment decision never rewrites service history.</AdminNotice>
    </AdminPage>
  );
}
