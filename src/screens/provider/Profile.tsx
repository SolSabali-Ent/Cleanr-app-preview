import { ArrowRight, Link2, UserRoundCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import ProfileScreen from "../../app/provider/screens/ProfileScreen";
import { ProviderProfileEnrichmentCard } from "../../components/profile/ProviderProfileEnrichmentCard";
import { cspRouteForContext } from "../../lib/contextualRoutes";

export function Profile() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <>
      <div className="px-4 pt-4" style={{ backgroundColor: "#0B1220" }}>
        <ProviderProfileEnrichmentCard />

        <section className="mb-6">
          <div className="mb-2">
            <h2 className="text-sm font-semibold text-white">Relationship links</h2>
            <p className="mt-1 text-xs leading-5" style={{ color: "#98A2B3" }}>
              Use the link that matches how the household knows you.
            </p>
          </div>

          <div className="border-y border-white/10">
            <button
              type="button"
              onClick={() => navigate(cspRouteForContext(pathname, "/csp/dashboard/affiliate"))}
              className="flex w-full items-center gap-3 border-b border-white/10 py-4 text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5">
                <Link2 size={17} style={{ color: "#8DCC64" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">New household</p>
                <p className="mt-1 text-xs" style={{ color: "#98A2B3" }}>Share Cleanr and earn when a new household stays.</p>
              </div>
              <ArrowRight size={16} style={{ color: "#98A2B3" }} />
            </button>

            <button
              type="button"
              onClick={() => navigate(cspRouteForContext(pathname, "/csp/dashboard/existing-clients"))}
              className="flex w-full items-center gap-3 py-4 text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5">
                <UserRoundCheck size={17} style={{ color: "#D0D5DD" }} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Existing client</p>
                <p className="mt-1 text-xs" style={{ color: "#98A2B3" }}>Preserve a relationship you already built before Cleanr.</p>
              </div>
              <ArrowRight size={16} style={{ color: "#98A2B3" }} />
            </button>
          </div>
        </section>
      </div>

      <div className="provider-profile-core">
        <ProfileScreen />
      </div>
    </>
  );
}
