import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
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
  cashOutProviderBalance,
  getProviderPayoutSummary,
  getProviderStripeDashboardUrl,
  setProviderPayoutSchedule,
  type ProviderPayoutSummary,
} from "@/lib/providerPayoutApi";
import {
  CSP_PRIMARY_BUTTON,
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

function formatShortDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return null;
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

function payoutStatus(row: ProviderEarningsBookingRow, variant: "pending" | "released") {
  if (variant === "released") {
    return {
      chip: "Released",
      detail: isLateCancellationCompensation(row)
        ? "Compensation was released to your Stripe balance."
        : "Cleanr released this earning to your Stripe balance.",
    };
  }
  if (isLateCancellationCompensation(row)) {
    if (row.payout_approved_at) return { chip: "Approved", detail: "Compensation is approved and waiting to be released." };
    return { chip: "Pending", detail: "Late-cancellation compensation is waiting on payout approval." };
  }
  if (row.status === "completed_by_provider") return { chip: "Waiting on customer", detail: "Service is complete. Customer confirmation is the next payout milestone." };
  if (row.payout_approved_at) return { chip: "Approved", detail: "Payout is approved and waiting to be released." };
  return { chip: "Pending", detail: "Service is confirmed and waiting on payout approval." };
}

function EarningsRow({ row, variant }: { row: ProviderEarningsBookingRow; variant: "pending" | "released" }) {
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

function payoutScheduleLabel(summary: ProviderPayoutSummary | null) {
  const interval = summary?.schedule.interval;
  if (interval === "weekly") return `Every ${summary?.schedule.weekly_day ?? "Friday"}`;
  if (interval === "daily") return "Every business day";
  if (interval === "manual") return "Keep available until I cash out";
  return interval ? interval.replaceAll("_", " ") : "Stripe schedule";
}

function payoutHistoryLabel(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "paid") return "Deposited";
  if (normalized === "in_transit" || normalized === "pending") return "On the way";
  if (normalized === "failed" || normalized === "canceled") return "Needs attention";
  return status.replaceAll("_", " ");
}

export default function EarningsScreen() {
  const { session, loading: sessionLoading } = useSession();
  const [rows, setRows] = useState<ProviderEarningsBookingRow[]>([]);
  const [payoutSummary, setPayoutSummary] = useState<ProviderPayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user?.id) {
      setRows([]);
      setPayoutSummary(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [earnings, payout] = await Promise.all([
        listProviderEarningsBookings(),
        getProviderPayoutSummary().catch(() => null),
      ]);
      setRows(earnings);
      setPayoutSummary(payout);
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

  const { pending, released } = useMemo(() => ({
    pending: rows.filter(isProviderPendingEarning),
    released: rows.filter(isProviderPaidEarning),
  }), [rows]);

  const practice = useMemo(() => buildServicePracticeSnapshot(rows.map((row) => ({ status: row.status, customerId: row.customer_id, scheduledStart: row.scheduled_start }))), [rows]);
  const pendingTotalCents = useMemo(() => pending.reduce((sum, row) => sum + providerEarningCentsFromRow(row), 0), [pending]);
  const releasedTotalCents = useMemo(() => released.reduce((sum, row) => sum + providerEarningCentsFromRow(row), 0), [released]);

  async function changeSchedule(interval: "daily" | "weekly" | "manual") {
    setPayoutLoading(true);
    setError(null);
    setNotice(null);
    try {
      await setProviderPayoutSchedule(interval, "friday");
      setNotice(interval === "weekly" ? "Automatic deposits set for Fridays." : interval === "daily" ? "Automatic deposits set for business days." : "Your Stripe balance will stay available until you cash out.");
      setPayoutSummary(await getProviderPayoutSummary());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update payout timing.");
    } finally {
      setPayoutLoading(false);
    }
  }

  async function cashOut() {
    if (!payoutSummary || payoutSummary.available_cents <= 0) return;
    setPayoutLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await cashOutProviderBalance(false);
      setNotice(`${formatUsdFromCents(result.amount_cents)} is on the way through Stripe.`);
      setPayoutSummary(await getProviderPayoutSummary());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start your payout.");
    } finally {
      setPayoutLoading(false);
    }
  }

  async function openStripe() {
    setPayoutLoading(true);
    setError(null);
    try {
      const url = await getProviderStripeDashboardUrl();
      window.location.assign(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open Stripe.");
      setPayoutLoading(false);
    }
  }

  if (sessionLoading || loading) return <div style={{ color: CSP_TEXT_PRIMARY }}><h1 className="text-2xl font-semibold">Earnings</h1><p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading earnings…</p></div>;

  return (
    <div className="relative" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Earnings</h1>
        <p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>See what you earned, what is available, and when money reaches your payout account.</p>
      </header>

      {error ? <div className="mb-4 border-y border-red-400/20 bg-red-950/20 py-3 text-sm text-red-200">{error}</div> : null}
      {notice ? <div className="mb-4 border-y border-emerald-400/20 bg-emerald-950/20 py-3 text-sm text-emerald-200">{notice}</div> : null}

      <section className="mb-7 border-y border-white/10 py-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>Pending</p>
            <p className="mt-1 text-xl font-semibold">{formatUsdFromCents(pendingTotalCents)}</p>
            <p className="mt-1 text-[10px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>Still clearing Cleanr</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>Available</p>
            <p className="mt-1 text-xl font-semibold">{formatUsdFromCents(payoutSummary?.available_cents ?? 0)}</p>
            <p className="mt-1 text-[10px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>In your Stripe balance</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>Processing</p>
            <p className="mt-1 text-xl font-semibold">{formatUsdFromCents(payoutSummary?.pending_cents ?? 0)}</p>
            <p className="mt-1 text-[10px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>Stripe balance pending</p>
          </div>
        </div>
      </section>

      {payoutSummary ? (
        <section style={{ marginBottom: CSP_SECTION_GAP }}>
          <div className="rounded-2xl border p-4" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Payout timing</p>
                <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{payoutScheduleLabel(payoutSummary)}</p>
              </div>
              <button type="button" onClick={() => void load()} className="min-h-10 min-w-10 rounded-xl border border-white/10" aria-label="Refresh payout balance">
                <RefreshCw className="mx-auto h-4 w-4" style={{ color: CSP_TEXT_SECONDARY }} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { key: "weekly", label: "Friday" },
                { key: "daily", label: "Daily" },
                { key: "manual", label: "Keep available" },
              ].map((option) => {
                const active = payoutSummary.schedule.interval === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    disabled={payoutLoading}
                    onClick={() => void changeSchedule(option.key as "daily" | "weekly" | "manual")}
                    className="min-h-11 rounded-xl border px-2 text-[11px] font-semibold disabled:opacity-50"
                    style={{ borderColor: active ? CSP_PRIMARY_BUTTON : "rgba(248,250,252,.10)", backgroundColor: active ? `${CSP_PRIMARY_BUTTON}18` : "transparent", color: active ? CSP_TEXT_PRIMARY : CSP_TEXT_SECONDARY }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void cashOut()}
              disabled={payoutLoading || payoutSummary.available_cents <= 0}
              className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
            >
              {payoutLoading ? "Working…" : payoutSummary.available_cents > 0 ? `Cash out ${formatUsdFromCents(payoutSummary.available_cents)}` : "Nothing available to cash out"}
            </button>
            <p className="mt-2 text-[11px] leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
              Cash out sends your currently available Stripe balance to your payout account. Automatic deposits continue on the schedule you choose.
            </p>
            {payoutSummary.instant_available_cents > 0 ? (
              <p className="mt-1 text-[11px] leading-5 text-emerald-300">Stripe currently shows {formatUsdFromCents(payoutSummary.instant_available_cents)} as instant-payout eligible. We’ll expose instant cash-out after the pilot fee policy is finalized.</p>
            ) : null}
            <button type="button" onClick={() => void openStripe()} disabled={payoutLoading} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 border-t border-white/10 pt-3 text-xs font-semibold" style={{ color: CSP_TEXT_SECONDARY }}>
              Manage payout account in Stripe <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </section>
      ) : (
        <section className="mb-7 border-y border-white/10 py-4">
          <p className="text-sm font-medium">Stripe balance unavailable</p>
          <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Your Cleanr earnings history is still shown below. Reconnect or finish payout setup if this persists.</p>
        </section>
      )}

      {payoutSummary?.payouts?.length ? (
        <section style={{ marginBottom: CSP_SECTION_GAP }}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_TEXT_SECONDARY }}>Deposits</h2>
          <div className="rounded-2xl border px-4" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            {payoutSummary.payouts.slice(0, 5).map((payout) => (
              <div key={payout.id} className="flex items-start justify-between gap-4 border-b border-white/10 py-4 last:border-b-0">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{payoutHistoryLabel(payout.status)}</p>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}>{payout.automatic ? "Automatic" : "Cash out"}</span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                    {payout.status === "paid" && payout.arrival_at ? `Deposited ${formatShortDate(payout.arrival_at)}` : payout.arrival_at ? `Expected ${formatShortDate(payout.arrival_at)}` : formatShortDate(payout.created_at) ?? "Stripe payout"}
                  </p>
                  {payout.failure_code ? <p className="mt-1 text-xs text-red-300">{payout.failure_code.replaceAll("_", " ")}</p> : null}
                </div>
                <p className="text-sm font-semibold">{formatUsdFromCents(payout.amount_cents)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_TEXT_SECONDARY }}>Pending earnings</h2>
        {pending.length === 0 ? (
          <p className="py-4 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>No pending earnings.</p>
        ) : (
          <div className="rounded-2xl border px-4" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            {pending.map((row) => <EarningsRow key={row.id} row={row} variant="pending" />)}
          </div>
        )}
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_TEXT_SECONDARY }}>Released earnings</h2>
        <p className="mb-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{formatUsdFromCents(releasedTotalCents)} has been released to Stripe across {released.length} earning{released.length === 1 ? "" : "s"}. Deposits above show when Stripe sends money onward.</p>
        {released.length === 0 ? (
          <p className="py-4 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>No released earnings yet.</p>
        ) : (
          <div className="rounded-2xl border px-4" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            {released.map((row) => <EarningsRow key={row.id} row={row} variant="released" />)}
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
