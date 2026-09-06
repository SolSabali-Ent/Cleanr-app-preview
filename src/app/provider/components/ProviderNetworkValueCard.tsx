import { useEffect, useState } from "react";
import { ArrowRight, Share2, Users, Wallet } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cspRouteForContext } from "@/lib/contextualRoutes";
import { getProviderAffiliateDashboard, type ProviderAffiliateDashboard } from "@/lib/providerAffiliateApi";
import { CSP_PRIMARY_BUTTON, CSP_SURFACE, CSP_TEXT_SECONDARY } from "@/theme/cspTheme";

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

export function ProviderNetworkValueCard() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [dashboard, setDashboard] = useState<ProviderAffiliateDashboard | null>(null);

  useEffect(() => {
    let active = true;
    getProviderAffiliateDashboard()
      .then((value) => { if (active) setDashboard(value); })
      .catch(() => { if (active) setDashboard(null); });
    return () => { active = false; };
  }, []);

  if (!dashboard) return null;

  const totalRelationshipStarts = dashboard.existingClientConnectedCount + dashboard.joinedCount;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Network value</p>
          <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Relationships and new demand you helped bring into Cleanr.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(cspRouteForContext(pathname, "/csp/dashboard/affiliate"))}
          className="text-xs font-semibold"
          style={{ color: CSP_PRIMARY_BUTTON }}
        >
          Open →
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate(cspRouteForContext(pathname, "/csp/dashboard/affiliate"))}
        className="w-full rounded-2xl border p-4 text-left transition-opacity hover:opacity-90"
        style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)" }}
      >
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}18` }}>
              <Users size={16} style={{ color: CSP_PRIMARY_BUTTON }} />
            </div>
            <p className="mt-2 text-lg font-semibold">{totalRelationshipStarts}</p>
            <p className="mt-0.5 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>Households connected</p>
          </div>
          <div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}18` }}>
              <Share2 size={16} style={{ color: CSP_PRIMARY_BUTTON }} />
            </div>
            <p className="mt-2 text-lg font-semibold">{dashboard.qualifiedCount}</p>
            <p className="mt-0.5 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>New households qualified</p>
          </div>
          <div>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}18` }}>
              <Wallet size={16} style={{ color: CSP_PRIMARY_BUTTON }} />
            </div>
            <p className="mt-2 text-lg font-semibold">{money(dashboard.availableCashCents)}</p>
            <p className="mt-0.5 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>Affiliate cash available</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <p className="text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
            Existing clients remain relationship provenance. Affiliate growth counts only genuinely new Cleanr households.
          </p>
          <ArrowRight size={16} className="shrink-0" style={{ color: CSP_PRIMARY_BUTTON }} />
        </div>
      </button>
    </section>
  );
}
