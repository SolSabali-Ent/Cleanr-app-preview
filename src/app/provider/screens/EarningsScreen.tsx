import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/useSession";
import { buildServicePracticeSnapshot } from "@/domain/servicePractice";
import {
  isLateCancellationCompensation,
  isProviderPaidEarning,
  isProviderPendingEarning,
  listProviderEarningsBookings,
  providerEarningCentsFromRow,
  type ProviderEarningsBookingRow,
} from "@/lib/providerEarningsApi";
import {
  CSP_SECTION_GAP,
  CSP_SURFACE,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

function formatUsdFromCents(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function serviceLabel(serviceType: string): string {
  const k = serviceType.trim().toLowerCase();
  if (k.includes("deep")) return "Deep Clean";
  if (k.includes("move")) return "Move-out Clean";
  if (k === "standard" || k.includes("standard")) return "Standard Clean";
  return serviceType.trim() || "Cleaning";
}

function formatScheduled(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function earningsSubtitle(row: ProviderEarningsBookingRow): string {
  const zip = row.zip_code?.trim();
  if (zip) return `ZIP ${zip}`;
  const addr = row.address;
  if (typeof addr === "string" && addr.trim()) return addr.trim();
  if (addr && typeof addr === "object") {
    const o = addr as Record<string, unknown>;
    const z = (o.zip ?? o.zip_code) as string | undefined;
    if (z && String(z).trim()) return `ZIP ${String(z).trim()}`;
    const line = o.address ?? o.line1;
    if (typeof line === "string" && line.trim()) return line.trim();
  }
  const suffix = row.id.replace(/-/g, "").slice(-8);
  return `Booking …${suffix}`;
}

function feePolicyCopy(row: ProviderEarningsBookingRow): string | null {
  if (isLateCancellationCompensation(row)) {
    return `Late-cancellation compensation · 50% of the reserved ${formatUsdFromCents(row.price_cents)} service price`;
  }
  if (!row.platform_fee_policy || row.platform_fee_rate_applied == null) return null;
  const rate = `${(row.platform_fee_rate_applied * 100).toFixed(2).replace(/\.00$/, "")}%`;
  if (row.platform_fee_policy === "provider_brought_relationship") return `${rate} Cleanr fee · existing relationship you brought to Cleanr`;
  if (row.platform_fee_policy === "priority_surcharge_100pct_provider") return `${rate} Cleanr fee on base clean only · priority surcharge is 100% yours`;
  if (row.platform_fee_policy === "provider_brought_relationship_plus_priority_surcharge_100pct_provider") return `${rate} Cleanr fee on base clean only · existing relationship rate · priority surcharge is 100% yours`;
  if (row.platform_fee_policy === "default") return `${rate} Cleanr platform fee`;
  return `${rate} Cleanr fee`;
}

function payoutStatus(row: ProviderEarningsBookingRow, variant: "pending" | "paid") {
  if (variant === "paid") {
    return { chip: "Paid", detail: isLateCancellationCompensation(row) ? "Cancellation compensation sent through Stripe." : row.payout_released_at ? "Stripe transfer recorded." : "Payout released." };
  }
  if (isLateCancellationCompensation(row)) {
    if (row.payout_approved_at) return { chip: "Approved", detail: "Compensation is approved and waiting on Stripe transfer." };
    return { chip: "Pending", detail: "Late-cancellation compensation is waiting on payout approval." };
  }
  if (row.status === "completed_by_provider") return { chip: "Waiting on customer", detail: "Service is complete. Customer confirmation is the next payout milestone." };
  if (row.payout_approved_at) return { chip: "Approved", detail: "Payout is approved and waiting on Stripe transfer." };
  return { chip: "Pending", detail: "Service is confirmed and waiting on payout approval." };
}

function EarningsRow({ row, variant }: { row: ProviderEarningsBookingRow; variant: "pending" | "paid" }) {
  const cents = providerEarningCentsFromRow(row);
  const payout = payoutStatus(row, variant);
  const feeCopy = feePolicyCopy(row);
  const priorityCents = row.priority_surcharge_cents ?? 0;
  const lateCancellation = isLateCancellationCompensation(row);

  return (
    <div className="border-b border-white/10 py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{lateCancellation ? "Late cancellation compensation" : serviceLabel(row.service_type)}</p>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium" style={{ color: CSP_TEXT_SECONDARY }}>{payout.chip}</span>
          </div>
          <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{formatScheduled(row.scheduled_start)} · {earningsSubtitle(row)}</p>
          <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{payout.detail}</p>
        </div>
        <p className="shrink-0 text-base font-semibold">{formatUsdFromCents(cents)}</p>
      </div>

      {(feeCopy || (!lateCancellation && priorityCents > 0)) ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11px] font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Earning details</summary>
          <div className="mt-2 space-y-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
            {!lateCancellation && priorityCents > 0 ? <p>Priority compensation: {formatUsdFromCents(priorityCents)} · 100% yours</p> : null}
            {feeCopy ? <p>{feeCopy}</p> : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

export default function EarningsScreen() {
  const { session, loading: sessionLoading } = useSession();
  const [rows, setRows] = useState<ProviderEarningsBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRows(await listProviderEarningsBookings());
    } catch {
      setError("load_failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (sessionLoading) return;
    void load();
  }, [sessionLoading, load]);

  const { pending, paid } = useMemo(() => ({
    pending: rows.filter(isProviderPendingEarning),
    paid: rows.filter(isProviderPaidEarning),
  }), [rows]);

  const practice = useMemo(() => buildServicePracticeSnapshot(rows.map((row) => ({ status: row.status, customerId: row.customer_id, scheduledStart: row.scheduled_start }))), [rows]);
  const pendingTotalCents = useMemo(() => pending.reduce((sum, row) => sum + providerEarningCentsFromRow(row), 0), [pending]);
  const paidTotalCents = useMemo(() => paid.reduce((sum, row) => sum + providerEarningCentsFromRow(row), 0), [paid]);

  if (sessionLoading || loading) return <div style={{ color: CSP_TEXT_PRIMARY }}><h1 className="text-2xl font-semibold">Earnings</h1><p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading earnings…</p></div>;
  if (error) return <div style={{ color: CSP_TEXT_PRIMARY }}><h1 className="text-2xl font-semibold">Earnings</h1><p className="mt-2 text-sm text-amber-200/90">Earnings could not be loaded.</p></div>;

  return (
    <div className="relative" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Earnings</h1>
        <p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>What is pending, what has been paid, and the work behind it.</p>
      </header>

      <section className="mb-7 border-y border-white/10 py-5">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Pending</p>
            <p className="mt-1 text-2xl font-semibold">{formatUsdFromCents(pendingTotalCents)}</p>
            <p className="mt-1 text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>{pending.length} earning{pending.length === 1 ? "" : "s"}</p>
          </div>
          <div>
            <p className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Paid</p>
            <p className="mt-1 text-2xl font-semibold">{formatUsdFromCents(paidTotalCents)}</p>
            <p className="mt-1 text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>{paid.length} payout{paid.length === 1 ? "" : "s"}</p>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_TEXT_SECONDARY }}>Pending</h2>
        {pending.length === 0 ? (
          <p className="py-4 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>No pending earnings.</p>
        ) : (
          <div className="rounded-2xl border px-4" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            {pending.map((row) => <EarningsRow key={row.id} row={row} variant="pending" />)}
          </div>
        )}
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_TEXT_SECONDARY }}>Paid</h2>
        {paid.length === 0 ? (
          <p className="py-4 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>No paid payouts yet.</p>
        ) : (
          <div className="rounded-2xl border px-4" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            {paid.map((row) => <EarningsRow key={row.id} row={row} variant="paid" />)}
          </div>
        )}
      </section>

      {(practice.confirmedServicesCount > 0 || practice.repeatHouseholdsCount > 0) ? (
        <details className="border-t border-white/10 pt-4">
          <summary className="cursor-pointer text-sm font-medium">Your service practice</summary>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div><p className="text-xl font-semibold">{practice.confirmedServicesCount}</p><p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>confirmed services</p></div>
            <div><p className="text-xl font-semibold">{practice.repeatHouseholdsCount}</p><p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>repeat households</p></div>
            <div><p className="text-xl font-semibold">{practice.confirmedHouseholdsCount}</p><p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>households served</p></div>
            <div><p className="text-xl font-semibold">{practice.returningHouseholdsScheduledCount}</p><p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>returning households scheduled</p></div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
