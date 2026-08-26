import { useState } from "react";
import { LogOut, HelpCircle, CreditCard, MapPin, Phone, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "../../components/ui/Button";
import { createReferral } from "@/lib/referralApi";

export function CustomerProfile() {
  const navigate = useNavigate();
  const [inviteCopied, setInviteCopied] = useState(false);
  const name = "Shine Campbell";
  const phone = "+1 (404) 123-4567";
  const email = "shine@example.com";

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
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="text-[#0B1220]">
      <h1 className="text-xl font-semibold mb-4">Profile</h1>

      <section className="provider-card mb-4 flex gap-3">
        <div className="w-12 h-12 rounded-full bg-[#F3FAF1] border border-[#DCEED7] flex items-center justify-center text-lg font-semibold text-[#166534]">
          {name.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-semibold">{name}</p>
          <p className="text-xs text-[#667085]">{email}</p>
          <p className="text-xs text-[#667085]">{phone}</p>
        </div>
      </section>

      <section className="provider-card p-1 mb-3">
        <div className="w-full flex items-center justify-between px-3 py-3 text-left">
          <div className="flex items-center gap-3">
            <CreditCard className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Payment methods</p>
              <p className="text-xs text-[#667085]">
                Manage your saved cards
              </p>
            </div>
          </div>
        </div>
        <div className="h-px bg-[#E5E7EB] mx-3" />
        <div className="w-full flex items-center justify-between px-3 py-3 text-left">
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Addresses</p>
              <p className="text-xs text-[#667085]">
                Home, office, or recurring locations
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="provider-card p-1 mb-3">
        <button
          type="button"
          onClick={handleInviteLink}
          className="w-full flex items-center justify-between px-3 py-3 text-left hover:bg-[#F3FAF1]/50 rounded-lg transition"
        >
          <div className="flex items-center gap-3">
            <Share2 className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Invite friends</p>
              <p className="text-xs text-[#667085]">
                {inviteCopied ? "Link copied" : "Get your invite link"}
              </p>
            </div>
          </div>
        </button>
        <div className="h-px bg-[#E5E7EB] mx-3" />
        <div className="w-full flex items-center justify-between px-3 py-3 text-left">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Support & FAQ</p>
              <p className="text-xs text-[#667085]">
                Get help, see policies, or contact us
              </p>
            </div>
          </div>
        </div>
        <div className="h-px bg-[#E5E7EB] mx-3" />
        <div className="w-full flex items-center justify-between px-3 py-3 text-left">
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-[#8DCC64]" />
            <div>
              <p className="text-sm">Emergency contact</p>
              <p className="text-xs text-[#667085]">
                For urgent issues with a cleaning
              </p>
            </div>
          </div>
        </div>
      </section>

      <Button
        className="mt-2"
        variant="secondary"
        size="lg"
        fullWidth
        leftIcon={<LogOut className="w-3 h-3" />}
        onClick={handleLogout}
      >
        Log out
      </Button>
    </div>
  );
}

