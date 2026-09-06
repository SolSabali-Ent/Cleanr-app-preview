import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Share2, Users, Wallet } from "lucide-react";
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

  useEffect(() => {
    let active = true;
    getProviderAffiliateDashboard()
      .then((value) => { if (active) setDashboard(value); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Unable to load affiliate activity."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const shareUrl = useMemo(() => dashboard?.code ? providerAffiliateUrl(dashboard.code) : null, [dashboard?.code]);

  async function activate() {
    setAction("activate"); setError(null);
    try { setDashboard(await activateProviderAffiliateAccount()); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to create your share link."); }
    finally { setAction(null); }
  }

  async function cashout() {
    setAction("cashout"); setError(null);
    try { setDashboard(await requestProviderAffiliateCashout()); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to request your affiliate payout."); }
    finally { setAction(null); }
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch { setError("We couldn't copy the link. Try sharing it instead."); }
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

  return (
    <div className="min-h-screen px-4 pt-6 pb-24" style={{ backgroundColor: CSP_BACKGROUND, color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate(-1)} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <ArrowLeft size={16} /> Back
      </button>

      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_PRIMARY_BUTTON }}>Grow the network</p>
        <h1 className="mt-1 text-2xl font-semibold">Share Cleanr. Earn when a new household stays.</h1>
        <p className="mt-2 text-sm leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
          This link is for households that are new to Cleanr. Existing clients you already serve use the separate relationship invite so your prior relationship stays attached to you.
        </p>
      </header>

      {error ? <p className="mb-4 rounded-xl bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</p> : null}

      {loading ? (
        <div className="rounded-2xl border p-5" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
          <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading…</p>
        </div>
      ) : !dashboard?.active ? (
        <section className="rounded-2xl border p-5" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
          <h2 className="text-lg font-semibold">Your reusable Cleanr link</h2>
          <p className="mt-2 text-sm leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
            A new household gets {money(dashboard?.friendCreditCents ?? 1500)} toward its first cleaning. After its first confirmed paid cleaning, you earn {money(dashboard?.cashRewardCents ?? 2000)}. If it reaches {dashboard?.retentionBookingCount ?? 3} confirmed cleanings, you earn another {money(dashboard?.retentionBonusCents ?? 1000)}.
          </p>
          <button type="button" disabled={action !== null} onClick={() => void activate()} className="mt-5 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
            {action === "activate" ? "Creating link…" : "Get my share link"}
          </button>
        </section>
      ) : (
        <>
          <section className="mb-4 rounded-2xl border p-5" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: CSP_PRIMARY_BUTTON }}>Your link</p>
            <p className="mt-2 break-all text-sm font-medium">{shareUrl}</p>
            <p className="mt-2 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>New households get {money(dashboard.friendCreditCents)} automatically.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void copy()} className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold"><Copy size={14} /> {copied ? "Copied" : "Copy"}</button>
              <button type="button" onClick={() => void share()} className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}><Share2 size={14} /> Share</button>
            </div>
          </section>

          <section className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border p-4" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}><Users size={18} style={{ color: CSP_PRIMARY_BUTTON }} /><p className="mt-3 text-2xl font-semibold">{dashboard.joinedCount}</p><p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>new households joined</p></div>
            <div className="rounded-2xl border p-4" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}><CheckCircle2 size={18} style={{ color: CSP_PRIMARY_BUTTON }} /><p className="mt-3 text-2xl font-semibold">{dashboard.qualifiedCount}</p><p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>first cleanings confirmed</p></div>
          </section>

          <section className="mb-4 rounded-2xl border p-5" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            <div className="flex items-center gap-2"><Wallet size={16} style={{ color: CSP_PRIMARY_BUTTON }} /><h2 className="text-sm font-semibold">Affiliate earnings</h2></div>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex justify-between"><span style={{ color: CSP_TEXT_SECONDARY }}>Available</span><span className="font-semibold">{money(dashboard.availableCashCents)}</span></p>
              <p className="flex justify-between"><span style={{ color: CSP_TEXT_SECONDARY }}>Paid</span><span className="font-semibold">{money(dashboard.cashPaidCents)}</span></p>
              <p className="flex justify-between"><span style={{ color: CSP_TEXT_SECONDARY }}>Cash-out starts at</span><span className="font-semibold">{money(dashboard.cashoutThresholdCents)}</span></p>
            </div>

            {dashboard.pendingRequest ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-semibold">{money(dashboard.pendingRequest.amountCents)} payout requested</p>
                <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                  {dashboard.pendingRequest.status === "requested" ? "Cleanr is reviewing it." : dashboard.pendingRequest.status === "approved" ? "Approved and ready to send." : "Stripe transfer is in progress."}
                </p>
              </div>
            ) : dashboard.cashoutEligible ? (
              <button type="button" disabled={action !== null || !dashboard.payoutReady} onClick={() => void cashout()} className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
                {action === "cashout" ? "Requesting…" : dashboard.payoutReady ? `Cash out ${money(dashboard.availableCashCents)}` : "Finish Stripe payout setup first"}
              </button>
            ) : (
              <p className="mt-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{money(Math.max(0, dashboard.cashoutThresholdCents - dashboard.availableCashCents))} more until cash-out.</p>
            )}
          </section>

          <section className="mb-4 rounded-2xl border p-5" style={{ backgroundColor: "rgba(141,204,100,.06)", borderColor: "rgba(141,204,100,.22)" }}>
            <h2 className="text-sm font-semibold">Already your client?</h2>
            <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
              Don’t use the affiliate link. Existing-client invitations preserve that relationship as provider-brought and keep its separate Cleanr fee economics. You currently have {dashboard.existingClientConnectedCount} connected existing client{dashboard.existingClientConnectedCount === 1 ? "" : "s"}.
            </p>
            <button type="button" onClick={() => navigate(cspRouteForContext(pathname, "/csp/dashboard/existing-clients"))} className="mt-3 text-xs font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>Bring an existing client →</button>
          </section>

          <section className="rounded-2xl border p-4" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            <h2 className="text-sm font-semibold">How value circulates</h2>
            <div className="mt-3 space-y-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
              <p>1. A new household uses your link and gets {money(dashboard.friendCreditCents)} toward its first cleaning.</p>
              <p>2. After its first confirmed paid cleaning, you earn {money(dashboard.cashRewardCents)}.</p>
              <p>3. When it reaches {dashboard.retentionBookingCount} confirmed cleanings, you earn another {money(dashboard.retentionBonusCents)}.</p>
              <p>4. Affiliate earnings are separate from your cleaning payouts and flow through the Stripe Connect account you already use with Cleanr.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
