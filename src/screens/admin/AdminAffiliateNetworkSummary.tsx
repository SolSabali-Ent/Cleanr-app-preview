import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { AdminNotice, AdminStatStrip } from "./AdminUi";

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

  if (error) return <AdminNotice tone="warning">{error}</AdminNotice>;
  if (!summary) return <p className="text-sm text-slate-500">Loading affiliate network summary…</p>;

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0000FE]">Collective growth</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Value created through the network</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">Track whether sharing creates qualified households and value that circulates back to participants.</p>
          </div>
          <p className="text-xs text-slate-500">
            CSP: {summary.provider_households_qualified} qualified · Customer: {summary.customer_households_qualified} qualified
          </p>
        </div>
      </div>

      <AdminStatStrip
        items={[
          { label: "Active advocates", value: summary.total_active_advocates, detail: `${summary.provider_active_advocates} CSP · ${summary.customer_active_advocates} customer` },
          { label: "Households joined", value: summary.total_households_joined, detail: `${summary.total_households_qualified} qualified` },
          { label: "Available rewards", value: money(summary.total_available_reward_cents), detail: "Approved and not reserved" },
          { label: "Rewards paid", value: money(summary.total_paid_reward_cents), detail: "Circulated back to participants" },
        ]}
      />

      <details className="border-y border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-slate-700">Breakdown by growth source</summary>
        <div className="grid gap-4 border-t border-slate-200 px-4 py-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-slate-900">CSP-created demand</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{summary.provider_active_advocates} advocates · {summary.provider_households_joined} joined · {summary.provider_households_qualified} qualified</p>
            <p className="mt-1 text-xs text-slate-500">{money(summary.provider_available_reward_cents)} available · {money(summary.provider_paid_reward_cents)} paid</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-900">Customer-created demand</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{summary.customer_active_advocates} advocates · {summary.customer_households_joined} joined · {summary.customer_households_qualified} qualified</p>
            <p className="mt-1 text-xs text-slate-500">{money(summary.customer_available_reward_cents)} available · {money(summary.customer_paid_reward_cents)} paid</p>
          </div>
        </div>
      </details>
    </section>
  );
}
