import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { adminTheme } from "../../theme/adminTheme";

type Summary = {
  provider_active_advocates: number;
  provider_households_joined: number;
  provider_households_qualified: number;
  provider_available_reward_cents: number;
  provider_paid_reward_cents: number;
  customer_active_advocates: number;
  customer_households_joined: number;
  customer_households_qualified: number;
  customer_available_reward_cents: number;
  customer_paid_reward_cents: number;
  total_active_advocates: number;
  total_households_joined: number;
  total_households_qualified: number;
  total_available_reward_cents: number;
  total_paid_reward_cents: number;
};

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function Stat({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
      <p className="text-xs font-medium" style={{ color: adminTheme.textSecondary }}>{label}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>{value}</p>
      <p className="mt-1 text-xs leading-5" style={{ color: adminTheme.textSecondary }}>{note}</p>
    </div>
  );
}

export function AdminAffiliateNetworkSummary() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.rpc("get_admin_affiliate_network_summary")
      .then(({ data, error: rpcError }) => {
        if (!active) return;
        if (rpcError) setError(rpcError.message);
        else setSummary((data ?? null) as Summary | null);
      });
    return () => { active = false; };
  }, []);

  if (error) {
    return <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}>{error}</div>;
  }

  if (!summary) {
    return <div className="rounded-xl border px-4 py-4 text-sm" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card, color: adminTheme.textSecondary }}>Loading collective growth…</div>;
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: adminTheme.primary }}>Collective growth</p>
        <h2 className="mt-1 text-xl font-semibold" style={{ color: adminTheme.textPrimary }}>Value created through the network</h2>
        <p className="mt-1 text-sm" style={{ color: adminTheme.textSecondary }}>A transaction is useful; the durable asset is the relationships, demand, participation, and opportunity that remain afterward.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <Stat label="Active advocates" value={summary.total_active_advocates} note="Customers + CSPs with active share rails." />
        <Stat label="Households joined" value={summary.total_households_joined} note="New households attributed through affiliate growth." />
        <Stat label="Qualified households" value={summary.total_households_qualified} note="Households that reached a qualifying paid cleaning." />
        <Stat label="Available rewards" value={money(summary.total_available_reward_cents)} note="Approved cash value not currently reserved for payout." />
        <Stat label="Rewards paid" value={money(summary.total_paid_reward_cents)} note="Cash value already circulated back to participants." />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
          <p className="font-semibold" style={{ color: adminTheme.textPrimary }}>CSP-created demand</p>
          <p className="mt-2 text-sm" style={{ color: adminTheme.textSecondary }}>{summary.provider_active_advocates} active CSP advocates · {summary.provider_households_joined} households joined · {summary.provider_households_qualified} qualified.</p>
          <p className="mt-2 text-xs" style={{ color: adminTheme.textSecondary }}>{money(summary.provider_available_reward_cents)} available · {money(summary.provider_paid_reward_cents)} paid.</p>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
          <p className="font-semibold" style={{ color: adminTheme.textPrimary }}>Customer-created demand</p>
          <p className="mt-2 text-sm" style={{ color: adminTheme.textSecondary }}>{summary.customer_active_advocates} active customer advocates · {summary.customer_households_joined} households joined · {summary.customer_households_qualified} qualified.</p>
          <p className="mt-2 text-xs" style={{ color: adminTheme.textSecondary }}>{money(summary.customer_available_reward_cents)} available · {money(summary.customer_paid_reward_cents)} paid.</p>
        </div>
      </div>
    </section>
  );
}
