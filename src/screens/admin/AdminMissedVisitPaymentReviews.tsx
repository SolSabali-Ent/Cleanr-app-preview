import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { adminTheme } from "../../theme/adminTheme";

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

  useEffect(() => {
    void load();
  }, [load]);

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

    setNotice("Payment review resolved with durable evidence preserved.");
    setNotes((current) => ({ ...current, [row.booking_id]: "" }));
    await load();
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: adminTheme.primary }}>
            Booking Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold" style={{ color: adminTheme.textPrimary }}>
            Missed Visit Payment Review
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6" style={{ color: adminTheme.textSecondary }}>
            Paid visits that were closed without rescheduling still need an explicit financial disposition. Scheduling truth and money truth remain separate.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
          style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card, color: adminTheme.textPrimary }}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <section className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: adminTheme.textPrimary }}>Open reviews</p>
            <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>
              {loading ? "Loading…" : `${rows.length} payment review${rows.length === 1 ? "" : "s"} require an operator decision.`}
            </p>
          </div>
          <div className="rounded-xl border px-4 py-3 text-center" style={{ borderColor: adminTheme.border }}>
            <p className="text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>{rows.length}</p>
            <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Open</p>
          </div>
        </div>
      </section>

      {!loading && rows.length === 0 ? (
        <section className="rounded-xl border p-6 text-center" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
          <p className="text-sm font-semibold" style={{ color: adminTheme.textPrimary }}>No missed-visit payment reviews are open.</p>
          <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>When a paid missed visit is closed without rescheduling, it will appear here until the money side is resolved.</p>
        </section>
      ) : null}

      <div className="space-y-4">
        {rows.map((row) => (
          <section key={row.booking_id} className="rounded-xl border p-5" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-lg font-semibold" style={{ color: adminTheme.textPrimary }}>{row.customer_name}</p>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">Payment review</span>
                  {row.recurring_plan_id ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-800">Recurring</span> : null}
                </div>
                <p className="mt-1 text-sm" style={{ color: adminTheme.textSecondary }}>
                  CSP: {row.provider_name} · Visit: {formatWhen(row.scheduled_start)}
                </p>
                <p className="mt-1 font-mono text-[11px]" style={{ color: adminTheme.textSecondary }}>{row.booking_id}</p>
              </div>
              <Link
                to={`/admin/full-app/customer/bookings/${row.booking_id}`}
                className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold"
                style={{ borderColor: adminTheme.border, color: adminTheme.primary }}
              >
                Inspect booking <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-xl border p-3" style={{ borderColor: adminTheme.border }}>
                <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Customer paid</p>
                <p className="mt-1 text-lg font-semibold">{money(row.customer_payment_cents)}</p>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: adminTheme.border }}>
                <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Refund recorded</p>
                <p className="mt-1 text-lg font-semibold">{money(row.refunded_amount_cents)}</p>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: adminTheme.border }}>
                <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Net still represented as paid</p>
                <p className="mt-1 text-lg font-semibold">{money(row.net_payment_cents)}</p>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: adminTheme.border }}>
                <p className="text-[11px]" style={{ color: adminTheme.textSecondary }}>Scheduling closed</p>
                <p className="mt-1 text-sm font-semibold">{formatWhen(row.missed_visit_resolved_at)}</p>
              </div>
            </div>

            <div className="mt-5">
              <label className="text-xs font-semibold" style={{ color: adminTheme.textPrimary }} htmlFor={`note-${row.booking_id}`}>
                Resolution note
              </label>
              <textarea
                id={`note-${row.booking_id}`}
                value={notes[row.booking_id] ?? ""}
                onChange={(event) => setNotes((current) => ({ ...current, [row.booking_id]: event.target.value }))}
                placeholder="Document what happened and why this financial disposition is correct."
                rows={3}
                className="mt-2 w-full rounded-xl border px-3 py-2 text-sm"
                style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface, color: adminTheme.textPrimary }}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === row.booking_id}
                onClick={() => void resolve(row, "refund_recorded")}
                className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                style={{ borderColor: adminTheme.border, color: adminTheme.textPrimary }}
              >
                Refund recorded
              </button>
              <button
                type="button"
                disabled={busyId === row.booking_id}
                onClick={() => void resolve(row, "credit_recorded")}
                className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                style={{ borderColor: adminTheme.border, color: adminTheme.textPrimary }}
              >
                Customer credit recorded
              </button>
              <button
                type="button"
                disabled={busyId === row.booking_id}
                onClick={() => void resolve(row, "no_adjustment_needed")}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: adminTheme.primary }}
              >
                No adjustment needed
              </button>
            </div>
            <p className="mt-3 text-[11px] leading-5" style={{ color: adminTheme.textSecondary }}>
              Refund and credit resolutions are evidence-gated. “No adjustment needed” requires an explicit operator note because it leaves the recorded payment unchanged.
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
