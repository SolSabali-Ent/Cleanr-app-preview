import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type SummaryRow = {
  window_months: number;
  service_paid_cents: number;
  affiliate_cash_paid_cents: number;
  total_cleanr_cash_cents: number;
  months_with_service_payouts: number;
  months_with_affiliate_cash: number;
  providers_with_any_paid_cash: number;
  providers_with_multiple_paid_sources: number;
};

type MonthlyRow = {
  month_start: string;
  service_paid_cents: number;
  service_payout_count: number;
  affiliate_cash_paid_cents: number;
  affiliate_cashout_count: number;
  total_cleanr_cash_cents: number;
  providers_with_service_income: number;
  providers_with_affiliate_income: number;
  providers_with_multiple_income_sources: number;
};

function usd(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function AdminEconomicAgencyActivity({ circleId }: { circleId: string | null }) {
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setError(null);
      const [summaryResult, monthlyResult] = await Promise.all([
        supabase.rpc("get_admin_economic_agency_summary", { p_circle_id: circleId, p_months: 6 }),
        supabase.rpc("get_admin_economic_agency_monthly", { p_circle_id: circleId, p_months: 6 }),
      ]);
      const firstError = summaryResult.error ?? monthlyResult.error;
      if (firstError) {
        setError(firstError.message);
        setSummary(null);
        setMonthly([]);
        return;
      }
      setSummary(((summaryResult.data ?? [])[0] ?? null) as SummaryRow | null);
      setMonthly((monthlyResult.data ?? []) as MonthlyRow[]);
    })();
  }, [circleId]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Economic agency activity</p>
        <h2 className="mt-1 font-semibold text-slate-950">Paid Cleanr-origin cash evidence · last 6 months</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
          Uses existing payout truth only: released residential service earnings and paid CSP affiliate cashouts. This is not a claim about full personal income, household finances, or financial stability.
        </p>
      </div>

      {error ? <p className="p-5 text-sm text-red-700">{error}</p> : summary ? (
        <>
          <div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-4">
            <div className="bg-white p-5"><p className="text-xs text-slate-500">Service cash paid</p><p className="mt-1 text-xl font-bold text-slate-950">{usd(summary.service_paid_cents)}</p><p className="mt-2 text-[11px] text-slate-500">Across {summary.months_with_service_payouts} paid month{summary.months_with_service_payouts === 1 ? "" : "s"}</p></div>
            <div className="bg-white p-5"><p className="text-xs text-slate-500">Affiliate cash paid</p><p className="mt-1 text-xl font-bold text-slate-950">{usd(summary.affiliate_cash_paid_cents)}</p><p className="mt-2 text-[11px] text-slate-500">Across {summary.months_with_affiliate_cash} paid month{summary.months_with_affiliate_cash === 1 ? "" : "s"}</p></div>
            <div className="bg-white p-5"><p className="text-xs text-slate-500">Total Cleanr-origin paid cash</p><p className="mt-1 text-xl font-bold text-slate-950">{usd(summary.total_cleanr_cash_cents)}</p><p className="mt-2 text-[11px] text-slate-500">Authoritative released/paid records only</p></div>
            <div className="bg-white p-5"><p className="text-xs text-slate-500">Providers with paid cash</p><p className="mt-1 text-xl font-bold text-slate-950">{summary.providers_with_any_paid_cash}</p><p className="mt-2 text-[11px] text-slate-500">{summary.providers_with_multiple_paid_sources} with service + affiliate cash</p></div>
          </div>

          <div className="border-t border-slate-200 px-5 py-4">
            <p className="text-xs font-semibold text-slate-600">Monthly evidence</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              {monthly.map((row) => (
                <div key={row.month_start} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{new Date(`${row.month_start}T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</p>
                  <p className="mt-1 text-sm font-bold text-slate-950">{usd(row.total_cleanr_cash_cents)}</p>
                  <p className="mt-2 text-[10px] leading-4 text-slate-500">{row.service_payout_count} service payouts · {row.affiliate_cashout_count} affiliate cashouts</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : <p className="p-5 text-sm text-slate-500">Loading economic-agency evidence…</p>}
    </section>
  );
}
