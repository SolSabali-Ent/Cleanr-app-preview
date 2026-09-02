import { useState } from "react";
import { LogOut, HelpCircle, CreditCard, MapPin, Phone, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "@/lib/useProfile";
import { useSession } from "@/lib/useSession";
import { signOutCleanr } from "@/lib/authSession";
import { Button } from "../../components/ui/Button";
import { CustomerHouseholdMemoryCard } from "../components/CustomerHouseholdMemoryCard";
import { createReferral } from "@/lib/referralApi";

export function CustomerProfile() {
  const navigate = useNavigate();
  const { session } = useSession();
  const { profile, loading: profileLoading } = useProfile();
  const [inviteCopied, setInviteCopied] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const email = session?.user.email ?? null;
  const name = profile?.full_name?.trim() || email?.split("@")[0] || "Cleanr customer";
  const phone = profile?.phone?.trim() || null;
  const initial = name.charAt(0).toUpperCase() || "C";

  const actionRowClass = "w-full flex items-center justify-between px-3 py-3 text-left hover:bg-[#F3FAF1]/50 rounded-lg transition";

  const handleInviteLink = async () => {
    try {
      const { code } = await createReferral();
      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/signin?ref=${encodeURIComponent(code)}`;
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
    } catch {
      // non-blocking
    }
  };

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
        <button type="button" onClick={() => navigate("/app/payments")} className={actionRowClass}>
          <div className="flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Payment methods</p>
              <p className="text-xs text-[#667085]">Manage your saved cards</p>
            </div>
          </div>
        </button>
        <div className="h-px bg-[#E5E7EB] mx-3" />
        <button type="button" onClick={() => navigate("/app/addresses")} className={actionRowClass}>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Addresses</p>
              <p className="text-xs text-[#667085]">Home, office, or recurring locations</p>
            </div>
          </div>
        </button>
      </section>

      <section className="provider-card p-1 mb-3">
        <button type="button" onClick={handleInviteLink} className={actionRowClass}>
          <div className="flex items-center gap-3">
            <Share2 className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Invite friends</p>
              <p className="text-xs text-[#667085]">{inviteCopied ? "Link copied" : "Get your invite link"}</p>
            </div>
          </div>
        </button>
        <div className="h-px bg-[#E5E7EB] mx-3" />
        <button type="button" onClick={() => navigate("/app/support")} className={actionRowClass}>
          <div className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Support & FAQ</p>
              <p className="text-xs text-[#667085]">Get help, see policies, or contact us</p>
            </div>
          </div>
        </button>
        <div className="h-px bg-[#E5E7EB] mx-3" />
        <button type="button" onClick={() => navigate("/app/emergency")} className={actionRowClass}>
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Emergency contact</p>
              <p className="text-xs text-[#667085]">For urgent issues with a cleaning</p>
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
