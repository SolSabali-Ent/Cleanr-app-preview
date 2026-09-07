import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type FeePolicyRow = {
  fee_policy: string;
  booking_count: number;
  gross_service_cents: number;
  platform_fee_cents: number;
  average_rate_applied: number | null;
  classified_rate_count: number;
};

function usd(cents: number) {
  return (Number(cents || 0) / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function policyLabel(policy: string) {
  if (policy === "provider_brought_relationship") return "Provider-brought relationship";
  if (policy === "default") return "Default Cleanr policy";
  if (policy === "historical_unclassified") return "Historical · provenance not persisted";
  return policy.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdminFeePolicyEconomics({ circleId }: { circleId: string | null }) {
  const [rows, setRows] = useState<FeePolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void supabase.rpc("get_admin_platform_fee_policy_summary", { p_circle_id: circleId }).then(({ data, error: rpcError }) => {
      if (!active) return;
      if (rpcError) {
        setError(rpcError.message);
        setRows([]);
      } else {
        setRows((data ?? []) as FeePolicyRow[]);
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [circleId]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-700">Relationship economics provenance</p>
        <h2 className="mt-1 font-semibold text-slate-950">Which fee policy produced each booking economics snapshot?</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
          Descriptive audit only. New checkouts persist the applied fee policy and rate with the booking. Older paid bookings remain explicitly unclassified rather than being reverse-engineered after the fact.
        </p>
      </div>

      {loading ? (
        <p className="p-5 text-sm text-slate-500">Loading fee-policy provenance…</p>
      ) : error ? (
        <p className="p-5 text-sm text-red-700">{error}</p>
      ) : rows.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No checkout or paid-booking fee-policy evidence in this scope yet.</p>
      ) : (
        <div className="grid gap-px bg-slate-100 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.fee_policy} className="bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">{policyLabel(row.fee_policy)}</p>
              <p className="mt-3 text-2xl font-bold text-slate-950">{row.booking_count.toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">booking economics snapshots</p>
              <div className="mt-4 space-y-1 text-xs text-slate-600">
                <p>Gross service value: <span className="font-semibold text-slate-800">{usd(row.gross_service_cents)}</span></p>
                <p>Platform fee value: <span className="font-semibold text-slate-800">{usd(row.platform_fee_cents)}</span></p>
                <p>Average persisted rate: <span className="font-semibold text-slate-800">{row.average_rate_applied == null ? "Not persisted" : `${(Number(row.average_rate_applied) * 100).toFixed(2)}%`}</span></p>
              </div>
              {row.fee_policy === "historical_unclassified" ? (
                <p className="mt-3 text-[11px] leading-4 text-amber-700">Cleanr knows the historical fee amount but does not claim which policy produced it.</p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs leading-5 text-slate-600">
        Fee policy is infrastructure, not a permanent identity. Persisting provenance lets Cleanr later evaluate economics by relationship origin and actual services provided without rewriting history.
      </div>
    </section>
  );
}
