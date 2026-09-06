import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Gift, Share2, Users, Wallet } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { customerRouteForContext } from "../../lib/contextualRoutes";
import {
  activateCustomerAffiliateAccount,
  chooseCustomerAffiliateReward,
  customerAffiliateUrl,
  getCustomerAffiliateDashboard,
  getCustomerAffiliatePayoutStatus,
  requestCustomerAffiliateCashout,
  startCustomerAffiliatePayoutSetup,
  syncCustomerAffiliatePayoutSetup,
  type AffiliateRewardChoice,
  type CustomerAffiliateDashboard,
  type CustomerAffiliatePayoutStatus,
} from "../../lib/customerAffiliateApi";

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export function Affiliate() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const profilePath = customerRouteForContext(pathname, "/app/profile");
  const [dashboard, setDashboard] = useState<CustomerAffiliateDashboard | null>(null);
  const [payout, setPayout] = useState<CustomerAffiliatePayoutStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [choosingRewardId, setChoosingRewardId] = useState<string | null>(null);
  const [payoutAction, setPayoutAction] = useState<"setup" | "cashout" | "sync" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [nextDashboard, nextPayout] = await Promise.all([
      getCustomerAffiliateDashboard(),
      getCustomerAffiliatePayoutStatus(),
    ]);
    setDashboard(nextDashboard);
    setPayout(nextPayout);
  }

  useEffect(() => {
    let active = true;
    const returningFromPayout = searchParams.get("payout") === "return";
    const load = async () => {
      try {
        if (returningFromPayout) await syncCustomerAffiliatePayoutSetup();
        const [nextDashboard, nextPayout] = await Promise.all([
          getCustomerAffiliateDashboard(),
          getCustomerAffiliatePayoutStatus(),
        ]);
        if (active) { setDashboard(nextDashboard); setPayout(nextPayout); }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load your referral activity.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [searchParams]);

  const shareUrl = useMemo(() => dashboard?.code ? customerAffiliateUrl(dashboard.code) : null, [dashboard?.code]);

  async function activate() {
    setActivating(true); setError(null);
    try { await activateCustomerAffiliateAccount(); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to start your referral link."); }
    finally { setActivating(false); }
  }

  async function chooseReward(rewardId: string, choice: AffiliateRewardChoice) {
    setChoosingRewardId(rewardId); setError(null);
    try { await chooseCustomerAffiliateReward(rewardId, choice); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to save your reward choice."); }
    finally { setChoosingRewardId(null); }
  }

  async function setupPayouts() {
    setPayoutAction("setup"); setError(null);
    try { window.location.assign(await startCustomerAffiliatePayoutSetup()); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to start payout setup."); setPayoutAction(null); }
  }

  async function syncPayouts() {
    setPayoutAction("sync"); setError(null);
    try { setPayout(await syncCustomerAffiliatePayoutSetup()); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to refresh payout setup."); }
    finally { setPayoutAction(null); }
  }

  async function requestCashout() {
    setPayoutAction("cashout"); setError(null);
    try { setPayout(await requestCustomerAffiliateCashout()); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to request your cash-out."); }
    finally { setPayoutAction(null); }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2200); }
    catch { setError("We couldn't copy the link. Try Share instead."); }
  }

  async function shareLink() {
    if (!shareUrl || !dashboard) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "$15 toward your first Cleanr cleaning", text: `I sent you ${money(dashboard.friendCreditCents)} toward your first Cleanr cleaning. No code needed.`, url: shareUrl });
        return;
      } catch (err) { if (err instanceof DOMException && err.name === "AbortError") return; }
    }
    await copyLink();
  }

  return (
    <div className="text-[#0B1220] pb-4">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-3 w-3" />} className="mb-4 !px-0 text-[#667085]" onClick={() => navigate(profilePath)}>Back</Button>

      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#166534]">Share &amp; earn</p>
        <h1 className="mt-1 text-xl font-semibold">Give $15. Earn $20 — or $25 for Cleanr.</h1>
        <p className="mt-2 text-sm leading-5 text-[#667085]">Your friend gets help with their first cleaning. You earn after that cleaning is completed.</p>
      </header>

      {error ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="provider-card"><p className="text-sm text-[#667085]">Loading…</p></div>
      ) : !dashboard?.active ? (
        <section className="provider-card p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3FAF1] text-[#166534]"><Gift className="h-5 w-5" /></div>
          <h2 className="mt-4 text-lg font-semibold">Your personal Cleanr link</h2>
          <p className="mt-2 text-sm leading-5 text-[#667085]">Friends get $15 toward their first cleaning. After their first paid cleaning is completed, you choose $20 in earnings or $25 in Cleanr credit.</p>
          <Button className="mt-5" variant="primaryGreen" size="lg" fullWidth disabled={activating} loading={activating} onClick={() => void activate()}>{activating ? "Setting it up…" : "Get my share link"}</Button>
        </section>
      ) : (
        <>
          {dashboard.readyRewards.length > 0 ? (
            <section className="mb-4 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#166534]">Reward ready</p>
              <h2 className="mt-2 text-lg font-semibold">Choose how you want it.</h2>
              <p className="mt-1 text-sm text-[#667085]">Take {money(dashboard.cashRewardCents)} in earnings or get {money(dashboard.cleanrCreditRewardCents)} to use on Cleanr.</p>
              {dashboard.readyRewards.map((reward) => (
                <div key={reward.id} className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="secondary" size="md" fullWidth disabled={choosingRewardId === reward.id} onClick={() => void chooseReward(reward.id, "cash")}>{money(dashboard.cashRewardCents)} earnings</Button>
                  <Button variant="primaryGreen" size="md" fullWidth disabled={choosingRewardId === reward.id} onClick={() => void chooseReward(reward.id, "cleanr_credit")}>{money(dashboard.cleanrCreditRewardCents)} Cleanr credit</Button>
                </div>
              ))}
            </section>
          ) : null}

          <section className="provider-card p-5 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#166534]">Your link</p>
            <p className="mt-2 break-all text-sm font-medium">{shareUrl}</p>
            <p className="mt-2 text-xs text-[#667085]">They get {money(dashboard.friendCreditCents)} automatically. No promo code.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="md" fullWidth leftIcon={<Copy className="h-4 w-4" />} onClick={() => void copyLink()}>{copied ? "Copied" : "Copy"}</Button>
              <Button variant="primaryGreen" size="md" fullWidth leftIcon={<Share2 className="h-4 w-4" />} onClick={() => void shareLink()}>Share</Button>
            </div>
          </section>

          <section className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4"><Users className="h-5 w-5 text-[#166534]" /><p className="mt-3 text-2xl font-semibold">{dashboard.joinedCount}</p><p className="mt-1 text-xs text-[#667085]">Friends joined</p></div>
            <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4"><CheckCircle2 className="h-5 w-5 text-[#166534]" /><p className="mt-3 text-2xl font-semibold">{dashboard.qualifiedCount}</p><p className="mt-1 text-xs text-[#667085]">First cleanings completed</p></div>
          </section>

          <section className="provider-card p-5 mb-4">
            <div className="flex items-center gap-2"><Wallet className="h-4 w-4 text-[#166534]" /><h2 className="text-sm font-semibold">Your rewards</h2></div>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex justify-between"><span className="text-[#667085]">Available earnings</span><span className="font-semibold">{money(payout?.availableCashCents ?? dashboard.cashEarningsCents)}</span></p>
              <p className="flex justify-between"><span className="text-[#667085]">Cleanr credit</span><span className="font-semibold">{money(dashboard.cleanrCreditBalanceCents)}</span></p>
              <p className="flex justify-between"><span className="text-[#667085]">Cash-out starts at</span><span className="font-semibold">{money(payout?.cashoutThresholdCents ?? dashboard.cashoutThresholdCents)}</span></p>
            </div>

            {payout?.pendingRequest ? (
              <div className="mt-4 rounded-xl bg-[#F2F4F7] p-3">
                <p className="text-sm font-semibold">{money(payout.pendingRequest.amountCents)} cash-out requested</p>
                <p className="mt-1 text-xs text-[#667085]">
                  {payout.pendingRequest.status === "requested" ? "Cleanr is reviewing it." : payout.pendingRequest.status === "approved" ? "Approved and ready to send." : "Payment is being sent."}
                </p>
              </div>
            ) : payout?.cashoutEligible ? (
              <div className="mt-4">
                {!payout.payoutReady ? (
                  <>
                    <Button variant="primaryGreen" size="md" fullWidth disabled={payoutAction !== null} loading={payoutAction === "setup"} onClick={() => void setupPayouts()}>Set up cash payouts</Button>
                    {payout.setupStarted ? <Button className="mt-2" variant="secondary" size="sm" fullWidth disabled={payoutAction !== null} onClick={() => void syncPayouts()}>Refresh payout setup</Button> : null}
                    <p className="mt-2 text-[11px] leading-4 text-[#98A2B3]">Stripe securely collects your payout details. Cleanr does not store your bank account number.</p>
                  </>
                ) : (
                  <Button variant="primaryGreen" size="md" fullWidth disabled={payoutAction !== null} loading={payoutAction === "cashout"} onClick={() => void requestCashout()}>Cash out {money(payout.availableCashCents)}</Button>
                )}
              </div>
            ) : (
              <p className="mt-3 text-[11px] leading-4 text-[#98A2B3]">{money(Math.max(0, (payout?.cashoutThresholdCents ?? dashboard.cashoutThresholdCents) - (payout?.availableCashCents ?? dashboard.cashEarningsCents)))} more in earnings until cash-out.</p>
            )}
          </section>

          <section className="rounded-2xl bg-[#F7F9FC] p-4">
            <h2 className="text-sm font-semibold">How it works</h2>
            <div className="mt-3 space-y-3 text-sm text-[#667085]">
              <p><span className="font-semibold text-[#0B1220]">1.</span> Share your link. They get {money(dashboard.friendCreditCents)} toward their first cleaning.</p>
              <p><span className="font-semibold text-[#0B1220]">2.</span> After that cleaning is completed, you choose {money(dashboard.cashRewardCents)} earnings or {money(dashboard.cleanrCreditRewardCents)} Cleanr credit.</p>
              <p><span className="font-semibold text-[#0B1220]">3.</span> Cash earnings can be withdrawn once you reach {money(dashboard.cashoutThresholdCents)}.</p>
              <p><span className="font-semibold text-[#0B1220]">4.</span> If they reach {dashboard.retentionBookingCount} completed cleanings, you earn another {money(dashboard.retentionBonusCents)}.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
