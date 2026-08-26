import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/useSession";
import {
  isProviderPaidEarning,
  isProviderPendingEarning,
  listProviderEarningsBookings,
  providerEarningCentsFromRow,
  type ProviderEarningsBookingRow,
} from "@/lib/bookingApi";
import {
  CSP_SURFACE,
  CSP_CARD_PADDING,
  CSP_SECTION_GAP,
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
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function earningsSubtitle(row: ProviderEarningsBookingRow): string {
  const zip = row.zip_code?.trim();
  if (zip) return `ZIP ${zip}`;
  const addr = row.address;
  if (typeof addr === "string" && addr.trim()) {
    const t = addr.trim();
    return t.length > 36 ? `${t.slice(0, 33)}…` : t;
  }
  if (addr && typeof addr === "object") {
    const o = addr as Record<string, unknown>;
    const z = (o.zip ?? o.zip_code) as string | undefined;
    if (z && String(z).trim()) return `ZIP ${String(z).trim()}`;
    const line = o.address ?? o.line1;
    if (typeof line === "string" && line.trim()) {
      const t = line.trim();
      return t.length > 36 ? `${t.slice(0, 33)}…` : t;
    }
  }
  const suffix = row.id.replace(/-/g, "").slice(-8);
  return `Booking …${suffix}`;
}

function EarningsRow({
  row,
  variant,
}: {
  row: ProviderEarningsBookingRow;
  variant: "pending" | "paid";
}) {
  const cents = providerEarningCentsFromRow(row);
  const chip =
    variant === "pending" ? "Pending payout" : "Paid";

  return (
    <div
      className="rounded-2xl border flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
      style={{
        backgroundColor: CSP_SURFACE,
        padding: CSP_CARD_PADDING,
        borderColor: "rgba(248, 250, 252, 0.08)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium" style={{ color: CSP_TEXT_PRIMARY }}>
            {serviceLabel(row.service_type)}
          </p>
          <span
            className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-medium shrink-0"
            style={{ color: CSP_TEXT_SECONDARY }}
          >
            {chip}
          </span>
        </div>
        <p className="text-sm mt-0.5" style={{ color: CSP_TEXT_SECONDARY }}>
          {formatScheduled(row.scheduled_start)}
        </p>
        <p className="text-xs mt-1 font-mono opacity-80" style={{ color: CSP_TEXT_SECONDARY }}>
          {earningsSubtitle(row)}
        </p>
      </div>
      <div className="text-left sm:text-right shrink-0">
        <p className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
          Payout
        </p>
        <p className="font-semibold text-lg" style={{ color: CSP_TEXT_PRIMARY }}>
          {formatUsdFromCents(cents)}
        </p>
      </div>
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
      const data = await listProviderEarningsBookings();
      setRows(data);
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

  const { pending, paid } = useMemo(() => {
    const pendingList = rows.filter(isProviderPendingEarning);
    const paidList = rows.filter(isProviderPaidEarning);
    return { pending: pendingList, paid: paidList };
  }, [rows]);

  const pendingTotalCents = useMemo(
    () => pending.reduce((s, r) => s + providerEarningCentsFromRow(r), 0),
    [pending]
  );
  const paidTotalCents = useMemo(
    () => paid.reduce((s, r) => s + providerEarningCentsFromRow(r), 0),
    [paid]
  );

  if (sessionLoading || loading) {
    return (
      <div className="relative" style={{ color: CSP_TEXT_PRIMARY }}>
        <header style={{ marginBottom: CSP_SECTION_GAP }}>
          <h1 className="text-2xl font-semibold">Earnings</h1>
          <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
            Loading earnings…
          </p>
        </header>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative" style={{ color: CSP_TEXT_PRIMARY }}>
        <header style={{ marginBottom: CSP_SECTION_GAP }}>
          <h1 className="text-2xl font-semibold">Earnings</h1>
          <p className="text-sm mt-2 text-amber-200/90">Earnings could not be loaded.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="relative" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Earnings</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Track completed work and payout status.
        </p>
      </header>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: CSP_TEXT_SECONDARY }}>
          Pending
        </h2>
        {pending.length === 0 ? (
          <div
            className="rounded-2xl border py-6 text-center text-sm"
            style={{
              backgroundColor: CSP_SURFACE,
              borderColor: "rgba(248, 250, 252, 0.08)",
              color: CSP_TEXT_SECONDARY,
            }}
          >
            No pending earnings yet.
          </div>
        ) : (
          <>
            <div
              className="rounded-2xl border p-4 mb-3"
              style={{
                backgroundColor: CSP_SURFACE,
                borderColor: "rgba(248, 250, 252, 0.08)",
              }}
            >
              <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                Pending total
              </p>
              <p className="text-xl font-semibold mt-0.5">{formatUsdFromCents(pendingTotalCents)}</p>
            </div>
            <div className="flex flex-col gap-3">
              {pending.map((row) => (
                <EarningsRow key={row.id} row={row} variant="pending" />
              ))}
            </div>
          </>
        )}
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: CSP_TEXT_SECONDARY }}>
          Paid
        </h2>
        {paid.length === 0 ? (
          <div
            className="rounded-2xl border py-6 text-center text-sm"
            style={{
              backgroundColor: CSP_SURFACE,
              borderColor: "rgba(248, 250, 252, 0.08)",
              color: CSP_TEXT_SECONDARY,
            }}
          >
            No paid payouts yet.
          </div>
        ) : (
          <>
            <div
              className="rounded-2xl border p-4 mb-3"
              style={{
                backgroundColor: CSP_SURFACE,
                borderColor: "rgba(248, 250, 252, 0.08)",
              }}
            >
              <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                Paid total
              </p>
              <p className="text-xl font-semibold mt-0.5">{formatUsdFromCents(paidTotalCents)}</p>
            </div>
            <div className="flex flex-col gap-3">
              {paid.map((row) => (
                <EarningsRow key={row.id} row={row} variant="paid" />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
