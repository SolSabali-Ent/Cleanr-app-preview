import { useState } from "react";
import { LogOut, HelpCircle, CreditCard, MapPin, Share2, Zap } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useProfile } from "@/lib/useProfile";
import { useSession } from "@/lib/useSession";
import { signOutCleanr } from "@/lib/authSession";
import { customerRouteForContext } from "@/lib/contextualRoutes";
import { Button } from "../../components/ui/Button";
import { CustomerHouseholdMemoryCard } from "../components/CustomerHouseholdMemoryCard";

export function CustomerProfile() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { session } = useSession();
  const { profile, loading: profileLoading } = useProfile();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const email = session?.user.email ?? null;
  const name = profile?.full_name?.trim() || email?.split("@")[0] || "Cleanr customer";
  const phone = profile?.phone?.trim() || null;
  const initial = name.charAt(0).toUpperCase() || "C";

  const actionRowClass = "w-full flex items-center justify-between px-3 py-3 text-left hover:bg-[#F3FAF1]/50 rounded-lg transition";
  const route = (canonicalPath: string) => customerRouteForContext(pathname, canonicalPath);

  const handleLogout = async () => {
    setLogoutError(null);
    setLogoutLoading(true);
    try {
      await signOutCleanr();
      navigate("/", { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div className="text-[#0B1220]">
      <h1 className="text-xl font-semibold mb-4">Profile</h1>

      <section className="provider-card mb-4 flex gap-3">
        <div className="w-12 h-12 rounded-full bg-[#F3FAF1] border border-[#DCEED7] flex items-center justify-center text-lg font-semibold text-[#166534]">
          {profileLoading ? "…" : initial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{profileLoading ? "Loading profile…" : name}</p>
          {email ? <p className="text-xs text-[#667085] break-all">{email}</p> : null}
          {phone ? <p className="text-xs text-[#667085]">{phone}</p> : null}
        </div>
      </section>

      <CustomerHouseholdMemoryCard />

      <section className="provider-card p-1 mb-3">
        <button type="button" onClick={() => navigate(route("/app/payments"))} className={actionRowClass}>
          <div className="flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Payment methods</p>
              <p className="text-xs text-[#667085]">Saved cards and your default payment</p>
            </div>
          </div>
        </button>
        <div className="h-px bg-[#E5E7EB] mx-3" />
        <button type="button" onClick={() => navigate(route("/app/addresses"))} className={actionRowClass}>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Your places</p>
              <p className="text-xs text-[#667085]">Homes you can book and pay for</p>
            </div>
          </div>
        </button>
      </section>

      <section className="provider-card p-1 mb-3">
        <button type="button" onClick={() => navigate("/book?priority=urgent")} className={actionRowClass}>
          <div className="flex items-center gap-3">
            <Zap className="w-4 h-4 text-[#B45309]" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">Priority cleaning</p>
                <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#92400E]">Short notice</span>
              </div>
              <p className="text-xs text-[#667085]">Need a cleaning sooner? Check priority availability.</p>
            </div>
          </div>
        </button>
        <div className="h-px bg-[#E5E7EB] mx-3" />
        <button type="button" onClick={() => navigate(route("/app/affiliate"))} className={actionRowClass}>
          <div className="flex items-center gap-3">
            <Share2 className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Share &amp; earn</p>
              <p className="text-xs text-[#667085]">Your referral link, activity, and rewards</p>
            </div>
          </div>
        </button>
        <div className="h-px bg-[#E5E7EB] mx-3" />
        <button type="button" onClick={() => navigate(route("/app/support"))} className={actionRowClass}>
          <div className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Help &amp; safety</p>
              <p className="text-xs text-[#667085]">Booking help, policies, and active-cleaning support</p>
            </div>
          </div>
        </button>
      </section>

      {logoutError ? <p className="mb-2 text-sm text-red-600" role="alert">{logoutError}</p> : null}

      <Button
        className="mt-2"
        variant="secondary"
        size="lg"
        fullWidth
        leftIcon={<LogOut className="w-3 h-3" />}
        onClick={handleLogout}
        disabled={logoutLoading}
        loading={logoutLoading}
      >
        {logoutLoading ? "Signing out…" : "Log out"}
      </Button>
    </div>
  );
}
