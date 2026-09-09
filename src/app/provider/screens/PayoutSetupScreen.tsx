import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useProfile } from "../../../lib/useProfile";
import { getStripeConnectLink, syncStripeConnectStatus } from "../../../lib/stripeConnect";
import {
  CSP_PRIMARY_BUTTON,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

function payoutReady(profile: { stripe_connect_ready?: boolean | null; stripe_connect_account_id?: string | null } | null): boolean {
  if (!profile) return false;
  return profile.stripe_connect_ready === true && Boolean(profile.stripe_connect_account_id?.trim());
}

export default function PayoutSetupScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, refresh } = useProfile();
  const stripeReturnSyncStartedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isReturn = searchParams.get("stripe_return") === "1";
  const ready = payoutReady(profile);
  const active = profile?.marketplace_access === true;

  useEffect(() => {
    if (!isReturn || !profile || stripeReturnSyncStartedRef.current) return;
    stripeReturnSyncStartedRef.current = true;
    let mounted = true;
    setSyncing(true);
    setError(null);
    setMessage(null);

    syncStripeConnectStatus()
      .then(async (res) => {
        if (!mounted) return;
        await refresh();
        if (!mounted) return;
        if (!res.ready) setMessage("Stripe is still checking your payout details.");
        navigate("/csp/dashboard/application/payout-setup", { replace: true });
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.message ?? "Could not check payout status.");
      })
      .finally(() => {
        if (mounted) setSyncing(false);
      });

    return () => { mounted = false; };
  }, [isReturn, profile?.id, refresh, navigate]);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { url } = await getStripeConnectLink();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start payout setup.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <p className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: CSP_TEXT_SECONDARY }}>Payouts</p>
        <h1 className="mt-2 text-2xl font-semibold">{ready ? "Payouts are connected" : "Connect your payouts"}</h1>
        <p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
          {ready
            ? active
              ? "Your Stripe account is ready for Cleanr payouts."
              : "Your Stripe account is ready. You still need final approval before you can get new Cleanr jobs."
            : "Connect a Stripe account so Cleanr can pay you for completed work."}
        </p>
      </header>

      <section className="mb-6 border-y border-white/10 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Stripe payout status</p>
            <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{ready ? "Bank and payout details approved" : syncing ? "Checking your Stripe account" : "Not connected yet"}</p>
          </div>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${ready ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" : syncing ? "border-amber-400/30 bg-amber-500/15 text-amber-200" : "border-white/10 bg-white/5 text-slate-300"}`}>
            {ready ? "Ready" : syncing ? "Checking" : "Action needed"}
          </span>
        </div>
      </section>

      {message ? <p className="mb-4 text-sm text-emerald-300">{message}</p> : null}
      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      {!ready ? (
        <>
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading || syncing}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          >
            {loading ? "Opening Stripe…" : syncing ? "Checking status…" : "Connect with Stripe"}
          </button>
          <details className="mt-4 border-t border-white/10 pt-4">
            <summary className="cursor-pointer text-xs font-semibold" style={{ color: CSP_TEXT_SECONDARY }}>How payout setup works</summary>
            <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Stripe checks the bank and identity details needed to pay you. Finishing Stripe does not by itself approve you for new Cleanr jobs.</p>
          </details>
        </>
      ) : (
        <button type="button" onClick={() => navigate("/csp/dashboard/earnings")} className="w-full rounded-xl py-3 text-sm font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>View earnings</button>
      )}

      <button
        type="button"
        onClick={() => navigate("/csp/dashboard/application")}
        className="mt-3 w-full py-3 text-sm font-medium"
        style={{ color: CSP_TEXT_SECONDARY }}
      >
        Back to setup
      </button>
    </div>
  );
}
