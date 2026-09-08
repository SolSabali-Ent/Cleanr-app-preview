import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { AdminAffiliateNetworkSummary } from "./AdminAffiliateNetworkSummary";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminStatus,
  AdminTableShell,
  AdminTabs,
} from "./AdminUi";

type CashoutRow = {
  id: string;
  amount_cents: number;
  status: string;
  payout_ready: boolean;
  requested_at: string;
  approved_at: string | null;
  stripe_transfer_id: string | null;
  failure_reason: string | null;
};

type CustomerCashoutRow = CashoutRow & { customer_id: string; customer_name: string | null };
type ProviderCashoutRow = CashoutRow & { provider_id: string; provider_name: string | null };
type AdjustmentRow = {
  adjustment_id: string;
  program: "customer_affiliate" | "provider_affiliate";
  reward_id: string;
  reward_stage: string;
  affiliate_person_id: string;
  affiliate_name: string | null;
  referred_customer_id: string;
  amount_cents: number;
  reason: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

type Rail = "customer" | "provider";
type View = "provider" | "customer" | "adjustments";

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string) {
  if (status === "paid") return "success" as const;
  if (status === "approved" || status === "processing") return "info" as const;
  if (status === "requested") return "warning" as const;
  if (status === "failed") return "danger" as const;
  return "neutral" as const;
}

export function AdminAffiliateCashouts() {
  const [customers, setCustomers] = useState<CustomerCashoutRow[]>([]);
  const [providers, setProviders] = useState<ProviderCashoutRow[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [view, setView] = useState<View>("provider");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [resolutionById, setResolutionById] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const [customerResult, providerResult, adjustmentResult] = await Promise.all([
      supabase.rpc("get_admin_customer_affiliate_cashouts"),
      supabase.rpc("get_admin_provider_affiliate_cashouts"),
      supabase.rpc("get_admin_affiliate_reward_adjustments", { p_status: "outstanding" }),
    ]);
    if (customerResult.error) setMessage(customerResult.error.message);
    else if (providerResult.error) setMessage(providerResult.error.message);
    else if (adjustmentResult.error) setMessage(adjustmentResult.error.message);
    else setMessage(null);
    setCustomers((customerResult.data ?? []) as CustomerCashoutRow[]);
    setProviders((providerResult.data ?? []) as ProviderCashoutRow[]);
    setAdjustments((adjustmentResult.data ?? []) as AdjustmentRow[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const openProvider = useMemo(() => providers.filter((row) => !["paid", "cancelled"].includes(row.status)).length, [providers]);
  const openCustomer = useMemo(() => customers.filter((row) => !["paid", "cancelled"].includes(row.status)).length, [customers]);

  async function approve(rail: Rail, id: string) {
    setActionId(id); setMessage(null);
    try {
      const rpc = rail === "provider" ? "admin_approve_provider_affiliate_cashout" : "admin_approve_customer_affiliate_cashout";
      const { error } = await supabase.rpc(rpc, { p_request_id: id });
      if (error) setMessage(error.message);
      else { setMessage(`${rail === "provider" ? "CSP" : "Customer"} affiliate cash-out approved. Stripe release remains separate.`); await load(); }
    } finally { setActionId(null); }
  }

  async function cancel(rail: Rail, id: string) {
    const owner = rail === "provider" ? "CSP" : "customer";
    if (!window.confirm(`Cancel this ${owner} affiliate cash-out? Reserved rewards will return to the available affiliate balance. This is only allowed before a Stripe transfer starts.`)) return;
    setActionId(id); setMessage(null);
    try {
      const rpc = rail === "provider" ? "admin_cancel_provider_affiliate_cashout" : "admin_cancel_customer_affiliate_cashout";
      const { error } = await supabase.rpc(rpc, { p_request_id: id, p_reason: "cancelled_by_admin" });
      if (error) setMessage(error.message);
      else { setMessage(`${rail === "provider" ? "CSP" : "Customer"} affiliate cash-out cancelled. Reserved rewards are available again.`); await load(); }
    } finally { setActionId(null); }
  }

  async function release(rail: Rail, id: string) {
    setActionId(id); setMessage(null);
    try {
      const fn = rail === "provider" ? "release-provider-affiliate-cashout" : "release-customer-affiliate-cashout";
      const { data, error } = await supabase.functions.invoke(fn, { body: { cashout_request_id: id } });
      if (error) { setMessage(error.message || "Affiliate cash-out release failed."); return; }
      const result = data as { error?: string; detail?: string; transfer_id?: string; already_released?: boolean } | null;
      if (result?.error) { setMessage(result.detail ? `${result.error}: ${result.detail}` : result.error); return; }
      setMessage(result?.already_released ? `Already sent · ${result.transfer_id ?? "Stripe transfer"}` : `Affiliate cash-out sent · ${result?.transfer_id ?? "Stripe transfer created"}`);
      await load();
    } finally { setActionId(null); }
  }

  async function resolveAdjustment(row: AdjustmentRow) {
    const note = resolutionById[row.adjustment_id]?.trim();
    if (!note || actionId) return;
    setActionId(row.adjustment_id); setMessage(null);
    try {
      const { error } = await supabase.rpc("admin_resolve_affiliate_reward_adjustment", {
        p_adjustment_id: row.adjustment_id,
        p_resolution_note: note,
      });
      if (error) { setMessage(error.message); return; }
      setResolutionById((current) => ({ ...current, [row.adjustment_id]: "" }));
      setMessage("Affiliate reward adjustment resolved.");
      await load();
    } finally { setActionId(null); }
  }

  function cashoutTable(rail: Rail, rows: Array<CustomerCashoutRow | ProviderCashoutRow>) {
    if (!loading && rows.length === 0) {
      return <AdminEmptyState title={`No ${rail === "provider" ? "CSP" : "customer"} cash-outs yet`} />;
    }

    return (
      <AdminTableShell>
        <div className="grid grid-cols-[minmax(230px,1.2fr)_130px_140px_150px_minmax(250px,1.2fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span>{rail === "provider" ? "CSP" : "Customer"}</span><span>Amount</span><span>Status</span><span>Requested</span><span>Action</span>
        </div>
        {loading ? <p className="px-5 py-5 text-sm text-slate-500">Loading cash-outs…</p> : rows.map((row) => {
          const name = rail === "provider" ? (row as ProviderCashoutRow).provider_name || "CSP" : (row as CustomerCashoutRow).customer_name || "Customer";
          const ready = row.payout_ready;
          return (
            <div key={row.id} className="grid grid-cols-[minmax(230px,1.2fr)_130px_140px_150px_minmax(250px,1.2fr)] items-center gap-4 border-b border-slate-200 px-5 py-4 last:border-b-0">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{name}</p>
                <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{row.id}</p>
              </div>
              <p className="text-sm font-semibold text-slate-950">{money(row.amount_cents)}</p>
              <div>
                <AdminStatus tone={statusTone(row.status)}>{humanize(row.status)}</AdminStatus>
                {!ready && row.status === "requested" ? <p className="mt-1 text-[11px] text-amber-700">Payout setup needed</p> : null}
              </div>
              <p className="text-xs text-slate-500">{new Date(row.requested_at).toLocaleDateString()}</p>
              <div className="flex flex-wrap gap-2">
                {row.status === "requested" ? (
                  <>
                    <AdminPrimaryButton onClick={() => void approve(rail, row.id)} disabled={actionId === row.id || !ready}>{actionId === row.id ? "Working…" : "Approve"}</AdminPrimaryButton>
                    <AdminSecondaryButton onClick={() => void cancel(rail, row.id)} disabled={actionId === row.id}>Cancel</AdminSecondaryButton>
                  </>
                ) : row.status === "approved" ? (
                  <>
                    <AdminPrimaryButton onClick={() => void release(rail, row.id)} disabled={actionId === row.id}>{actionId === row.id ? "Working…" : "Send payout"}</AdminPrimaryButton>
                    <AdminSecondaryButton onClick={() => void cancel(rail, row.id)} disabled={actionId === row.id}>Cancel</AdminSecondaryButton>
                  </>
                ) : row.status === "processing" ? (
                  <AdminSecondaryButton onClick={() => void release(rail, row.id)} disabled={actionId === row.id}>{actionId === row.id ? "Working…" : "Retry / reconcile"}</AdminSecondaryButton>
                ) : row.status === "paid" ? (
                  <span className="text-xs text-emerald-700">Sent{row.stripe_transfer_id ? ` · ${row.stripe_transfer_id}` : ""}</span>
                ) : row.status === "cancelled" ? (
                  <span className="text-xs text-slate-500">Cancelled · rewards released</span>
                ) : (
                  <span className="text-xs text-red-700">{row.failure_reason || "Needs review"}</span>
                )}
              </div>
            </div>
          );
        })}
      </AdminTableShell>
    );
  }

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        eyebrow="Affiliate payouts"
        title="Reward cash-outs"
        description="Approve and release customer or CSP affiliate rewards without mixing them with cleaning-service payouts."
        actions={<AdminSecondaryButton disabled={loading} onClick={() => void load()}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</AdminSecondaryButton>}
      />

      {message ? <AdminNotice>{message}</AdminNotice> : null}

      <AdminAffiliateNetworkSummary />

      <AdminTabs
        value={view}
        onChange={setView}
        items={[
          { value: "provider", label: "CSP", count: openProvider },
          { value: "customer", label: "Customers", count: openCustomer },
          { value: "adjustments", label: "Adjustments", count: adjustments.length },
        ]}
      />

      {view === "provider" ? cashoutTable("provider", providers) : null}
      {view === "customer" ? cashoutTable("customer", customers) : null}

      {view === "adjustments" ? (
        adjustments.length === 0 && !loading ? (
          <AdminEmptyState title="No outstanding reward adjustments" description="Refund or reversal review holds will appear here when an already-paid affiliate reward needs evidence-based resolution." />
        ) : (
          <AdminTableShell>
            <div className="grid grid-cols-[minmax(220px,1fr)_150px_150px_minmax(300px,1.4fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Affiliate</span><span>Program</span><span>Amount</span><span>Resolution</span>
            </div>
            {loading ? <p className="px-5 py-5 text-sm text-slate-500">Loading adjustments…</p> : adjustments.map((row) => (
              <div key={row.adjustment_id} className="grid grid-cols-[minmax(220px,1fr)_150px_150px_minmax(300px,1.4fr)] items-start gap-4 border-b border-slate-200 px-5 py-4 last:border-b-0">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{row.affiliate_name || (row.program === "provider_affiliate" ? "CSP affiliate" : "Customer affiliate")}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{humanize(row.reason)} · {humanize(row.reward_stage)}</p>
                </div>
                <AdminStatus>{humanize(row.program)}</AdminStatus>
                <p className="text-sm font-semibold text-amber-700">{money(row.amount_cents)}</p>
                <div className="flex gap-2">
                  <input
                    value={resolutionById[row.adjustment_id] ?? ""}
                    onChange={(event) => setResolutionById((current) => ({ ...current, [row.adjustment_id]: event.target.value }))}
                    placeholder="How was this adjustment handled?"
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                  />
                  <AdminPrimaryButton onClick={() => void resolveAdjustment(row)} disabled={actionId === row.adjustment_id || !(resolutionById[row.adjustment_id]?.trim())}>{actionId === row.adjustment_id ? "Working…" : "Resolve"}</AdminPrimaryButton>
                </div>
              </div>
            ))}
          </AdminTableShell>
        )
      ) : null}

      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">Cash-out rules</summary>
        <p className="border-t border-slate-200 px-5 py-4 text-xs leading-5 text-slate-600">
          Approval and Stripe release remain separate. Requested or approved cash-outs may be cancelled before transfer processing; once processing begins, rewards stay reserved and the safe action is retry/reconcile using the existing idempotency path. Cleanr does not store bank-account numbers.
        </p>
      </details>
    </AdminPage>
  );
}
