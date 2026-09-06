import { ArrowRight, Link2, UserRoundCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ProfileScreen from "../../app/provider/screens/ProfileScreen";
import { cspRouteForContext } from "../../lib/contextualRoutes";

export function Profile() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <>
      <style>{`.provider-profile-core > div > section:nth-of-type(2) { display: none; }`}</style>
      <div className="px-4 pt-4" style={{ backgroundColor: "#0B1220" }}>
        <div className="mb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "#8DCC64" }}>
            Share Cleanr
          </p>
          <p className="mt-1 text-xs leading-5" style={{ color: "#98A2B3" }}>
            Choose the right link so Cleanr preserves how the relationship began.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => navigate(cspRouteForContext(pathname, "/csp/dashboard/affiliate"))}
            className="w-full rounded-2xl border px-4 py-4 text-left transition-opacity hover:opacity-90"
            style={{ backgroundColor: "rgba(141,204,100,.08)", borderColor: "rgba(141,204,100,.22)", color: "#F8FAFC" }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "rgba(141,204,100,.14)" }}>
                <Link2 size={18} style={{ color: "#8DCC64" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "#8DCC64" }}>
                  New household
                </p>
                <p className="mt-1 text-sm font-semibold">Share Cleanr & earn</p>
                <p className="mt-1 text-xs leading-5" style={{ color: "#98A2B3" }}>
                  Use your reusable referral link for someone who is genuinely new to Cleanr. They get a first-clean credit and you can earn as they use Cleanr.
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold" style={{ color: "#8DCC64" }}>Open new-household link</span>
                  <ArrowRight size={16} style={{ color: "#8DCC64" }} />
                </div>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate(cspRouteForContext(pathname, "/csp/dashboard/existing-clients"))}
            className="w-full rounded-2xl border px-4 py-4 text-left transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#111827", borderColor: "rgba(248,250,252,.10)", color: "#F8FAFC" }}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
                <UserRoundCheck size={18} style={{ color: "#D0D5DD" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "#98A2B3" }}>
                  Existing client
                </p>
                <p className="mt-1 text-sm font-semibold">Bring an existing client</p>
                <p className="mt-1 text-xs leading-5" style={{ color: "#98A2B3" }}>
                  Create a separate one-household invite for a client you already served before Cleanr. This preserves that relationship as provider-brought.
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold" style={{ color: "#D0D5DD" }}>Create existing-client link</span>
                  <ArrowRight size={16} style={{ color: "#D0D5DD" }} />
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>
      <div className="provider-profile-core">
        <ProfileScreen />
      </div>
    </>
  );
}
