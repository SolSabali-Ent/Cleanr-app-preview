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

type ContinuityRow = {
  window_months: number;
  window_start: string;
  window_end_exclusive: string;
  cohort_providers: number;
  continuous_providers: number;
  continuity_rate: number;
  total_released_service_cents: number;
};

function usd(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function monthLabel(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function AdminEconomicAgencyActivity({ circleId }: { circleId: string | null }) {
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const [continuity, setContinuity] = useState<ContinuityRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setError(null);
      const [summaryResult, monthlyResult, continuityResult] = await Promise.all([
        supabase.rpc("get_admin_economic_agency_summary", { p_circle_id: circleId, p_months: 6 }),
        supabase.rpc("get_admin_economic_agency_monthly", { p_circle_id: circleId, p_months: 6 }),
        supabase.rpc("get_admin_service_income_continuity", { p_circle_id: circleId }),
      ]);
      const firstError = summaryResult.error ?? monthlyResult.error ?? continuityResult.error;
      if (firstError) {
        setError(firstError.message);
        setSummary(null);
        setMonthly([]);
        setContinuity(null);
        return;
      }
      setSummary(((summaryResult.data ?? [])[0] ?? null) as SummaryRow | null);
      setMonthly((monthlyResult.data ?? []) as MonthlyRow[]);
      setContinuity(((continuityResult.data ?? [])[0] ?? null) as ContinuityRow | null);
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

          {continuity ? (
            <div className="border-t border-slate-200 bg-blue-50/40 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Service income continuity</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">Released residential service earnings across the last 3 completed calendar months</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Cohort = CSPs with released service earnings in {monthLabel(continuity.window_start)}. Continuous = those who also had released service earnings in each of the next two completed months. Affiliate cash and the current partial month are excluded.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white px-4 py-3 text-center"><p className="text-xl font-bold text-slate-950">{continuity.cohort_providers}</p><p className="text-[10px] text-slate-500">starting cohort</p></div>
                  <div className="rounded-xl bg-white px-4 py-3 text-center"><p className="text-xl font-bold text-slate-950">{continuity.continuous_providers}</p><p className="text-[10px] text-slate-500">all 3 months</p></div>
                  <div className="rounded-xl bg-white px-4 py-3 text-center"><p className="text-xl font-bold text-blue-700">{Number(continuity.continuity_rate || 0)}%</p><p className="text-[10px] text-slate-500">continuity rate</p></div>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-4 text-slate-500">This measures continuity of Cleanr residential service earnings only. It is not a measure of total income, savings, household stability, or financial wellbeing.</p>
            </div>
          ) : null}

          <div className="border-t border-slate-200 px-5 py-4">
            <p className="text-xs font-semibold text-slate-600">Monthly evidence</p>
            <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              {monthly.map((row) => (
                <div key={row.month_start} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{monthLabel(row.month_start)}</p>
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
