import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Gift, Share2, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { customerRouteForContext } from "../../lib/contextualRoutes";
import {
  activateCustomerAffiliateAccount,
  customerAffiliateUrl,
  getCustomerAffiliateDashboard,
  type CustomerAffiliateDashboard,
} from "../../lib/customerAffiliateApi";

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export function Affiliate() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const profilePath = customerRouteForContext(pathname, "/app/profile");
  const [dashboard, setDashboard] = useState<CustomerAffiliateDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getCustomerAffiliateDashboard()
      .then((value) => { if (active) setDashboard(value); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Unable to load your referral activity."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const shareUrl = useMemo(() => dashboard?.code ? customerAffiliateUrl(dashboard.code) : null, [dashboard?.code]);

  async function activate() {
    setActivating(true);
    setError(null);
    try {
      setDashboard(await activateCustomerAffiliateAccount());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start your referral link.");
    } finally {
      setActivating(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("We couldn't copy the link. Try Share instead.");
    }
  }

  async function shareLink() {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Try Cleanr",
          text: "I'm sharing Cleanr with you. Use my link if you decide to book a cleaning.",
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    await copyLink();
  }

  return (
    <div className="text-[#0B1220] pb-4">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-3 w-3" />} className="mb-4 !px-0 text-[#667085]" onClick={() => navigate(profilePath)}>
        Back
      </Button>

      <header className="mb-5">
        <h1 className="text-xl font-semibold">Share Cleanr</h1>
        <p className="mt-1 text-sm text-[#667085]">Invite people you know and track what your referrals make possible.</p>
      </header>

      {error ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {loading ? (
        <div className="provider-card"><p className="text-sm text-[#667085]">Loading…</p></div>
      ) : !dashboard?.active ? (
        <section className="provider-card p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3FAF1] text-[#166534]">
            <Gift className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Your referral opportunity</h2>
          <p className="mt-2 text-sm leading-5 text-[#667085]">
            Get one personal Cleanr link you can reuse. When someone joins through it and completes their first paid cleaning, the referral qualifies for a reward.
          </p>
          <Button className="mt-5" variant="primaryGreen" size="lg" fullWidth disabled={activating} loading={activating} onClick={() => void activate()}>
            {activating ? "Setting it up…" : "Get my referral link"}
          </Button>
          <p className="mt-3 text-center text-[11px] text-[#98A2B3]">Reward amount and payout are confirmed before anything is issued.</p>
        </section>
      ) : (
        <>
          <section className="provider-card p-5 mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#166534]">Your link</p>
            <p className="mt-2 break-all text-sm font-medium">{shareUrl}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="md" fullWidth leftIcon={<Copy className="h-4 w-4" />} onClick={() => void copyLink()}>
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="primaryGreen" size="md" fullWidth leftIcon={<Share2 className="h-4 w-4" />} onClick={() => void shareLink()}>
                Share
              </Button>
            </div>
          </section>

          <section className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
              <Users className="h-5 w-5 text-[#166534]" />
              <p className="mt-3 text-2xl font-semibold">{dashboard.joinedCount}</p>
              <p className="mt-1 text-xs text-[#667085]">Joined through you</p>
            </div>
            <div className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
              <CheckCircle2 className="h-5 w-5 text-[#166534]" />
              <p className="mt-3 text-2xl font-semibold">{dashboard.qualifiedCount}</p>
              <p className="mt-1 text-xs text-[#667085]">Completed first cleaning</p>
            </div>
          </section>

          <section className="provider-card p-5 mb-4">
            <h2 className="text-sm font-semibold">Rewards</h2>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-lg font-semibold">{dashboard.pendingRewardCount}</p><p className="text-[10px] text-[#667085]">Pending</p></div>
              <div><p className="text-lg font-semibold">{dashboard.approvedRewardCount}</p><p className="text-[10px] text-[#667085]">Approved</p></div>
              <div><p className="text-lg font-semibold">{dashboard.paidRewardCount}</p><p className="text-[10px] text-[#667085]">Paid</p></div>
            </div>
            {dashboard.approvedRewardCents > 0 || dashboard.paidRewardCents > 0 ? (
              <div className="mt-4 border-t border-[#EAECF0] pt-4 text-sm">
                {dashboard.approvedRewardCents > 0 ? <p className="flex justify-between"><span className="text-[#667085]">Approved</span><span className="font-semibold">{money(dashboard.approvedRewardCents)}</span></p> : null}
                {dashboard.paidRewardCents > 0 ? <p className="mt-2 flex justify-between"><span className="text-[#667085]">Paid</span><span className="font-semibold">{money(dashboard.paidRewardCents)}</span></p> : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl bg-[#F7F9FC] p-4">
            <h2 className="text-sm font-semibold">How it works</h2>
            <div className="mt-3 space-y-3 text-sm text-[#667085]">
              <p><span className="font-semibold text-[#0B1220]">1.</span> Share your personal link.</p>
              <p><span className="font-semibold text-[#0B1220]">2.</span> They create their own Cleanr account through it.</p>
              <p><span className="font-semibold text-[#0B1220]">3.</span> Their first paid cleaning is completed and confirmed.</p>
              <p><span className="font-semibold text-[#0B1220]">4.</span> Your referral becomes eligible for the current reward.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
