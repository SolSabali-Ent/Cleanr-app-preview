import { useState, useEffect } from "react";
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
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isReturn = searchParams.get("stripe_return") === "1";
  const ready = payoutReady(profile);
  const active = profile?.marketplace_access === true;

  useEffect(() => {
    if (!isReturn || !profile) return;
    let mounted = true;
    setSyncing(true);
    setError(null);
    syncStripeConnectStatus()
      .then(async (res) => {
        if (!mounted) return;
        await refresh();
        if (res.activated) {
          setMessage("Payout setup complete. Your provider account is active.");
        } else if (res.ready) {
          setMessage("Payout setup is complete. Your marketplace access remains restricted pending Cleanr review.");
        } else {
          setMessage("We’re still processing your payout details. This may take a moment.");
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e?.message ?? "Could not sync payout status.");
      })
      .finally(() => {
        if (mounted) setSyncing(false);
      });
    return () => { mounted = false; };
  }, [isReturn, profile?.id, refresh]);

  async function handleConnect() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { url } = await getStripeConnectLink();
      window.location.href = url;
      return;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start payout setup.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Payout Setup</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Connect with Stripe to receive payouts for completed jobs. Payout readiness and marketplace access are tracked separately.
        </p>
      </header>

      {ready && (
        <div
          className="mb-6 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(52, 211, 153, 0.3)", backgroundColor: "rgba(52, 211, 153, 0.08)", color: "rgb(167, 243, 208)" }}
        >
          {active
            ? "Payout setup complete. Your provider account is active."
            : "Payout setup complete. Marketplace access is still restricted."}
        </div>
      )}

      {isReturn && syncing && (
        <p className="text-sm mb-4" style={{ color: CSP_TEXT_SECONDARY }}>
          Syncing your payout status…
        </p>
      )}
      {message && <p className="text-sm mb-4 text-emerald-300">{message}</p>}
      {error && <p className="text-sm mb-4 text-red-300">{error}</p>}

      {!ready && (
        <div className="space-y-4" style={{ marginBottom: CSP_SECTION_GAP }}>
          <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
            You’ll complete a short Stripe onboarding flow to connect your bank account. For an approved, unrestricted provider, successful payout setup can complete initial marketplace activation.
          </p>
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          >
            {loading ? "Opening…" : "Connect with Stripe"}
          </button>
        </div>
      )}

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => navigate("/csp/dashboard/application-status")}
          className="w-full py-3 rounded-xl text-sm font-medium border"
          style={{ borderColor: "rgba(248, 250, 252, 0.12)", color: CSP_TEXT_SECONDARY }}
        >
          Back to Application Status
        </button>
        <button
          type="button"
          onClick={() => navigate("/csp/dashboard/application")}
          className="w-full py-3 rounded-xl text-sm font-medium border"
          style={{ borderColor: "rgba(248, 250, 252, 0.12)", color: CSP_TEXT_SECONDARY }}
        >
          Back to Checklist
        </button>
      </div>
    </div>
  );
}
