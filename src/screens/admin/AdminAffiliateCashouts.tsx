import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { adminTheme } from "../../theme/adminTheme";
import { AdminAffiliateNetworkSummary } from "./AdminAffiliateNetworkSummary";

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

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdminAffiliateCashouts() {
  const [customers, setCustomers] = useState<CustomerCashoutRow[]>([]);
  const [providers, setProviders] = useState<ProviderCashoutRow[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
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
      setMessage("Affiliate reward adjustment resolved with durable Admin evidence.");
      await load();
    } finally { setActionId(null); }
  }

  function table(rail: Rail, rows: Array<CustomerCashoutRow | ProviderCashoutRow>, title: string, description: string) {
    return (
      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold" style={{ color: adminTheme.textPrimary }}>{title}</h2><p className="text-sm" style={{ color: adminTheme.textSecondary }}>{description}</p></div>
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs" style={{ borderColor: adminTheme.border, color: adminTheme.textSecondary }}>
                <tr><th className="p-3">{rail === "provider" ? "CSP" : "Customer"}</th><th>Amount</th><th>Status</th><th>Payout setup</th><th>Requested</th><th className="pr-3">Action</th></tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="p-4 text-slate-500">Loading cash-outs…</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="p-4 text-slate-500">No {rail === "provider" ? "CSP" : "customer"} affiliate cash-outs yet.</td></tr> : rows.map((row) => {
                  const name = rail === "provider" ? (row as ProviderCashoutRow).provider_name || "CSP" : (row as CustomerCashoutRow).customer_name || "Customer";
                  return <tr key={row.id} className="border-b last:border-b-0" style={{ borderColor: adminTheme.border }}>
                    <td className="p-3"><p className="font-medium">{name}</p><p className="mt-0.5 font-mono text-[10px] text-slate-500">{row.id}</p></td>
                    <td className="font-semibold">{money(row.amount_cents)}</td><td>{row.status}</td><td>{row.payout_ready ? "Ready" : "Not ready"}</td><td>{new Date(row.requested_at).toLocaleDateString()}</td>
                    <td className="pr-3">
                      {row.status === "requested" ? <div className="flex gap-2"><button onClick={() => void approve(rail,row.id)} disabled={actionId===row.id||!row.payout_ready} className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{backgroundColor:adminTheme.primary}}>{actionId===row.id?"Working…":"Approve"}</button><button onClick={() => void cancel(rail,row.id)} disabled={actionId===row.id} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40" style={{borderColor:adminTheme.border,color:adminTheme.textPrimary}}>Cancel</button></div>
                      : row.status === "approved" ? <div className="flex gap-2"><button onClick={() => void release(rail,row.id)} disabled={actionId===row.id} className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{backgroundColor:adminTheme.primary}}>{actionId===row.id?"Working…":"Send payout"}</button><button onClick={() => void cancel(rail,row.id)} disabled={actionId===row.id} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40" style={{borderColor:adminTheme.border,color:adminTheme.textPrimary}}>Cancel</button></div>
                      : row.status === "processing" ? <button onClick={() => void release(rail,row.id)} disabled={actionId===row.id} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40" style={{borderColor:adminTheme.border,color:adminTheme.textPrimary}}>{actionId===row.id?"Working…":"Retry / reconcile"}</button>
                      : row.status === "paid" ? <span className="text-xs text-emerald-700">Sent</span>
                      : row.status === "cancelled" ? <span className="text-xs text-slate-500">Cancelled · rewards released</span>
                      : <span className="text-xs text-slate-500">{row.failure_reason || "—"}</span>}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-7">
      <header><p className="text-xs font-semibold uppercase tracking-wide" style={{color:adminTheme.primary}}>Affiliate payouts</p><h1 className="mt-1 text-2xl font-semibold" style={{color:adminTheme.textPrimary}}>Network reward cash-outs</h1><p className="mt-1 text-sm" style={{color:adminTheme.textSecondary}}>Customer and CSP affiliate rewards stay separate from cleaning-service payouts while using guarded Stripe release rails.</p></header>
      {message ? <div className="rounded-lg border px-3 py-2 text-sm" style={{borderColor:adminTheme.border,backgroundColor:adminTheme.surface}}>{message}</div> : null}
      <AdminAffiliateNetworkSummary />

      <section className="space-y-3">
        <div><h2 className="text-lg font-semibold" style={{color:adminTheme.textPrimary}}>Refund/reversal adjustments</h2><p className="text-sm" style={{color:adminTheme.textSecondary}}>If a qualifying clean is later fully refunded after its affiliate reward was already paid, Cleanr preserves payout history and creates an explicit review hold. Another affiliate cash-out is blocked until the adjustment is resolved with evidence.</p></div>
        <div className="rounded-xl border p-4" style={{borderColor:adminTheme.border,backgroundColor:adminTheme.card}}>
          {loading ? <p className="text-sm text-slate-500">Loading adjustments…</p> : adjustments.length === 0 ? <p className="text-sm text-slate-500">No outstanding affiliate reward adjustments.</p> : <div className="space-y-3">{adjustments.map((row) => <div key={row.adjustment_id} className="rounded-lg border p-3" style={{borderColor:adminTheme.border}}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold" style={{color:adminTheme.textPrimary}}>{row.affiliate_name || (row.program === "provider_affiliate" ? "CSP affiliate" : "Customer affiliate")}</p><p className="mt-1 text-xs" style={{color:adminTheme.textSecondary}}>{humanize(row.program)} · {humanize(row.reward_stage)} · {humanize(row.reason)}</p></div><p className="text-sm font-semibold text-amber-700">{money(row.amount_cents)} review hold</p></div>
            <p className="mt-2 text-[11px] text-slate-500">Created {new Date(row.created_at).toLocaleString()} · reward {row.reward_id}</p>
            <div className="mt-3 flex gap-2"><input value={resolutionById[row.adjustment_id] ?? ""} onChange={(event) => setResolutionById((current) => ({...current,[row.adjustment_id]:event.target.value}))} placeholder="How was this already-paid adjustment handled?" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" style={{borderColor:adminTheme.border}}/><button type="button" onClick={() => void resolveAdjustment(row)} disabled={actionId===row.adjustment_id || !(resolutionById[row.adjustment_id]?.trim())} className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{backgroundColor:adminTheme.primary}}>{actionId===row.adjustment_id?"Working…":"Resolve hold"}</button></div>
          </div>)}</div>}
        </div>
      </section>

      {table("provider", providers, "CSP affiliate cash-outs", "Rewards for bringing genuinely new households into Cleanr. CSP bank delivery uses the existing Stripe Connect account.")}
      {table("customer", customers, "Customer affiliate cash-outs", "Rewards earned through customer share-and-earn referrals.")}
      <p className="text-xs leading-5" style={{color:adminTheme.textSecondary}}>Approval and Stripe release remain intentionally separate. Requested or approved cash-outs may be cancelled; once processing begins, rewards stay reserved and the safe action is retry/reconcile with the same Stripe idempotency key. Cleanr does not store bank-account numbers.</p>
    </main>
  );
}
