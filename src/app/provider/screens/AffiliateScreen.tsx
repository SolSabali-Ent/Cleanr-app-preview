import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Copy, Share2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cspRouteForContext } from "@/lib/contextualRoutes";
import {
  activateProviderAffiliateAccount,
  getProviderAffiliateDashboard,
  providerAffiliateUrl,
  requestProviderAffiliateCashout,
  type ProviderAffiliateDashboard,
} from "@/lib/providerAffiliateApi";
import {
  CSP_BACKGROUND,
  CSP_PRIMARY_BUTTON,
  CSP_SURFACE,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function AffiliateScreen() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [dashboard, setDashboard] = useState<ProviderAffiliateDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"activate" | "cashout" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await getProviderAffiliateDashboard());
    } catch (err) {
      setDashboard(null);
      setError(err instanceof Error ? err.message : "Unable to load affiliate activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const shareUrl = useMemo(() => dashboard?.code ? providerAffiliateUrl(dashboard.code) : null, [dashboard?.code]);

  async function activate() {
    setAction("activate");
    setError(null);
    try {
      setDashboard(await activateProviderAffiliateAccount());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your share link.");
    } finally {
      setAction(null);
    }
  }

  async function cashout() {
    setAction("cashout");
    setError(null);
    try {
      setDashboard(await requestProviderAffiliateCashout());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request your affiliate payout.");
    } finally {
      setAction(null);
    }
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("We couldn't copy the link. Try sharing it instead.");
    }
  }

  async function share() {
    if (!shareUrl || !dashboard) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${money(dashboard.friendCreditCents)} toward a first Cleanr cleaning`,
          text: `I sent you ${money(dashboard.friendCreditCents)} toward your first Cleanr cleaning.`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    await copy();
  }

  const existingClientRoute = cspRouteForContext(pathname, "/csp/dashboard/existing-clients");

  return (
    <div className="min-h-screen px-4 pb-24 pt-5" style={{ backgroundColor: CSP_BACKGROUND, color: CSP_TEXT_PRIMARY }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 flex min-h-11 items-center gap-2 text-sm font-medium"
        style={{ color: CSP_TEXT_SECONDARY }}
      >
        <ArrowLeft size={17} /> Back
      </button>

      <header className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: CSP_PRIMARY_BUTTON }}>
          New household referrals
        </p>
        <h1 className="mt-2 text-[28px] font-semibold leading-[1.08] tracking-[-0.025em]">
          Share Cleanr. Earn when a new household stays.
        </h1>
        <p className="mt-3 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          Your referral link is for households that are new to Cleanr. When they become repeat customers, value comes back to you.
        </p>
      </header>

      <button
        type="button"
        onClick={() => navigate(existingClientRoute)}
        className="mb-6 flex w-full items-center justify-between gap-4 border-y border-white/10 py-4 text-left"
      >
        <div>
          <p className="text-sm font-semibold">Already clean for them?</p>
          <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
            Use an existing-client invite so the relationship stays attached to you.
          </p>
        </div>
        <span className="shrink-0 text-lg" style={{ color: CSP_TEXT_SECONDARY }}>→</span>
      </button>

      {loading ? (
        <section className="border-y border-white/10 py-8">
          <p className="text-sm font-medium">Loading your referral program…</p>
          <p className="mt-2 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
            Verifying your current link, rewards, and activity.
          </p>
        </section>
      ) : !dashboard ? (
        <section className="border-y border-white/10 py-7">
          <p className="text-base font-semibold">Referral activity is unavailable right now.</p>
          <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
            We couldn't verify your current referral details, so Cleanr is not showing fallback reward amounts. Nothing has been changed.
          </p>
          {error ? (
            <p className="mt-3 text-xs leading-5" style={{ color: "rgba(248, 180, 180, 0.9)" }}>{error}</p>
          ) : null}
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="mt-5 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold"
          >
            Try again
          </button>
        </section>
      ) : !dashboard.active ? (
        <section>
          {error ? (
            <p className="mb-4 rounded-xl border border-red-400/20 bg-red-950/20 px-3 py-2 text-xs text-red-100">{error}</p>
          ) : null}

          <div className="border-y border-white/10 py-5">
            <div className="grid grid-cols-3 divide-x divide-white/10">
              <div className="pr-3">
                <p className="text-2xl font-semibold tracking-tight">{money(dashboard.friendCreditCents)}</p>
                <p className="mt-1 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>They get toward their first clean</p>
              </div>
              <div className="px-3">
                <p className="text-2xl font-semibold tracking-tight">{money(dashboard.cashRewardCents)}</p>
                <p className="mt-1 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>You earn after the first confirmed clean</p>
              </div>
              <div className="pl-3">
                <p className="text-2xl font-semibold tracking-tight">+{money(dashboard.retentionBonusCents)}</p>
                <p className="mt-1 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
                  After {dashboard.retentionBookingCount} confirmed cleans
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={action !== null}
            onClick={() => void activate()}
            className="mt-6 w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          >
            {action === "activate" ? "Creating link…" : "Create my referral link"}
          </button>
          <p className="mt-3 text-center text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
            One reusable link for new households.
          </p>
        </section>
      ) : (
        <>
          {error ? (
            <p className="mb-4 rounded-xl border border-red-400/20 bg-red-950/20 px-3 py-2 text-xs text-red-100">{error}</p>
          ) : null}

          <section className="mb-6 rounded-2xl border p-5" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: CSP_PRIMARY_BUTTON }}>
              Your referral link
            </p>
            <p className="mt-3 break-all text-sm font-medium leading-5">{shareUrl}</p>
            <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
              New households get {money(dashboard.friendCreditCents)} automatically when they start through this link.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void copy()}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold"
              >
                <Copy size={14} /> {copied ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={() => void share()}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-white"
                style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
              >
                <Share2 size={14} /> Share
              </button>
            </div>
          </section>

          <section className="mb-7 border-y border-white/10 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: CSP_TEXT_SECONDARY }}>
              Referral activity
            </p>
            <div className="mt-4 grid grid-cols-3 divide-x divide-white/10">
              <div className="pr-3">
                <p className="text-2xl font-semibold">{dashboard.joinedCount}</p>
                <p className="mt-1 text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>Joined</p>
              </div>
              <div className="px-3">
                <p className="text-2xl font-semibold">{dashboard.qualifiedCount}</p>
                <p className="mt-1 text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>Qualified</p>
              </div>
              <div className="pl-3">
                <p className="text-2xl font-semibold">{money(dashboard.availableCashCents)}</p>
                <p className="mt-1 text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>Available</p>
              </div>
            </div>
          </section>

          <section className="mb-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Referral earnings</p>
                <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                  Separate from cleaning-service payouts.
                </p>
              </div>
              <p className="text-sm font-semibold">{money(dashboard.cashPaidCents)} paid</p>
            </div>

            {dashboard.pendingRequest ? (
              <div className="mt-4 border-y border-white/10 py-4">
                <p className="text-sm font-semibold">{money(dashboard.pendingRequest.amountCents)} payout requested</p>
                <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                  {dashboard.pendingRequest.status === "requested"
                    ? "Cleanr is reviewing it."
                    : dashboard.pendingRequest.status === "approved"
                      ? "Approved and ready to send."
                      : "Stripe transfer is in progress."}
                </p>
              </div>
            ) : dashboard.cashoutEligible ? (
              <button
                type="button"
                disabled={action !== null || !dashboard.payoutReady}
                onClick={() => void cashout()}
                className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
              >
                {action === "cashout"
                  ? "Requesting…"
                  : dashboard.payoutReady
                    ? `Cash out ${money(dashboard.availableCashCents)}`
                    : "Finish Stripe payout setup first"}
              </button>
            ) : (
              <p className="mt-4 border-y border-white/10 py-4 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                {money(Math.max(0, dashboard.cashoutThresholdCents - dashboard.availableCashCents))} more until cash-out.
              </p>
            )}
          </section>

          <section className="mb-7 border-y border-white/10 py-4">
            <button
              type="button"
              onClick={() => navigate(existingClientRoute)}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <div>
                <p className="text-sm font-semibold">Bring an existing client</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  {dashboard.existingClientConnectedCount} connected · preserves provider-brought relationship provenance.
                </p>
              </div>
              <span className="text-lg" style={{ color: CSP_TEXT_SECONDARY }}>→</span>
            </button>
          </section>

          <details className="border-b border-white/10 pb-4">
            <summary className="cursor-pointer list-none text-sm font-semibold">How referral value circulates</summary>
            <div className="mt-3 space-y-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
              <p>A new household gets {money(dashboard.friendCreditCents)} toward its first cleaning.</p>
              <p>After its first confirmed paid cleaning, you earn {money(dashboard.cashRewardCents)}.</p>
              <p>At {dashboard.retentionBookingCount} confirmed cleanings, you earn another {money(dashboard.retentionBonusCents)}.</p>
              <p>Referral earnings use your existing Stripe Connect payout setup and remain separate from service payouts.</p>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
