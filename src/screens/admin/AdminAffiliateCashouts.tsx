import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { adminTheme } from "../../theme/adminTheme";

 type CashoutRow = {
  id: string;
  customer_id: string;
  customer_name: string | null;
  amount_cents: number;
  status: string;
  payout_ready: boolean;
  requested_at: string;
  approved_at: string | null;
  stripe_transfer_id: string | null;
  failure_reason: string | null;
};

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export function AdminAffiliateCashouts() {
  const [rows, setRows] = useState<CashoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_admin_customer_affiliate_cashouts");
    if (error) setMessage(error.message);
    else setRows((data ?? []) as CashoutRow[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function approve(id: string) {
    setActionId(id); setMessage(null);
    try {
      const { error } = await supabase.rpc("admin_approve_customer_affiliate_cashout", { p_request_id: id });
      if (error) setMessage(error.message);
      else { setMessage("Affiliate cash-out approved. It still needs a separate Stripe release."); await load(); }
    } finally { setActionId(null); }
  }

  async function release(id: string) {
    setActionId(id); setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke("release-customer-affiliate-cashout", { body: { cashout_request_id: id } });
      if (error) { setMessage(error.message || "Affiliate cash-out release failed."); return; }
      const result = data as { error?: string; detail?: string; transfer_id?: string; already_released?: boolean } | null;
      if (result?.error) { setMessage(result.detail ? `${result.error}: ${result.detail}` : result.error); return; }
      setMessage(result?.already_released ? `Already sent · ${result.transfer_id ?? "Stripe transfer"}` : `Affiliate cash-out sent · ${result?.transfer_id ?? "Stripe transfer created"}`);
      await load();
    } finally { setActionId(null); }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: adminTheme.primary }}>Affiliate payouts</p>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>Customer cash-outs</h1>
        <p className="mt-1 text-sm" style={{ color: adminTheme.textSecondary }}>Review customer affiliate withdrawals before money is sent through Stripe.</p>
      </header>

      {message ? <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}>{message}</div> : null}

      <section className="overflow-hidden rounded-xl border" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs" style={{ borderColor: adminTheme.border, color: adminTheme.textSecondary }}>
              <tr><th className="p-3">Customer</th><th>Amount</th><th>Status</th><th>Payout setup</th><th>Requested</th><th className="pr-3">Action</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="p-4 text-sm text-slate-500">Loading cash-outs…</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="p-4 text-sm text-slate-500">No affiliate cash-outs yet.</td></tr> : rows.map((row) => (
                <tr key={row.id} className="border-b last:border-b-0" style={{ borderColor: adminTheme.border }}>
                  <td className="p-3"><p className="font-medium">{row.customer_name || "Customer"}</p><p className="mt-0.5 font-mono text-[10px] text-slate-500">{row.id}</p></td>
                  <td className="font-semibold">{money(row.amount_cents)}</td>
                  <td>{row.status}</td>
                  <td>{row.payout_ready ? "Ready" : "Not ready"}</td>
                  <td>{new Date(row.requested_at).toLocaleDateString()}</td>
                  <td className="pr-3">
                    {row.status === "requested" ? <button onClick={() => void approve(row.id)} disabled={actionId === row.id || !row.payout_ready} className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{ backgroundColor: adminTheme.primary }}>{actionId === row.id ? "Working…" : "Approve"}</button> : row.status === "approved" ? <button onClick={() => void release(row.id)} disabled={actionId === row.id} className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40" style={{ backgroundColor: adminTheme.primary }}>{actionId === row.id ? "Sending…" : "Send payout"}</button> : row.status === "paid" ? <span className="text-xs text-emerald-700">Sent</span> : <span className="text-xs text-slate-500">{row.failure_reason || "—"}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs leading-5" style={{ color: adminTheme.textSecondary }}>Approval and Stripe release are intentionally separate during the soft launch. Cleanr does not store customer bank-account numbers; Stripe handles payout onboarding and bank delivery.</p>
    </main>
  );
}
