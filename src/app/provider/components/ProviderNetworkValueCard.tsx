import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppList, AppListRow } from "@/components/shared/AppUi";
import { cspRouteForContext } from "@/lib/contextualRoutes";
import { getProviderAffiliateDashboard, type ProviderAffiliateDashboard } from "@/lib/providerAffiliateApi";
import { CSP_PRIMARY_BUTTON } from "@/theme/cspTheme";

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

  const householdsConnected = dashboard.existingClientConnectedCount + dashboard.joinedCount;
  const hasValue = householdsConnected > 0 || dashboard.qualifiedCount > 0 || dashboard.availableCashCents > 0;
  if (!hasValue) return null;

  const parts = [
    householdsConnected > 0 ? `${householdsConnected} household${householdsConnected === 1 ? "" : "s"} connected` : null,
    dashboard.qualifiedCount > 0 ? `${dashboard.qualifiedCount} new qualified` : null,
    dashboard.availableCashCents > 0 ? `${money(dashboard.availableCashCents)} available` : null,
  ].filter(Boolean);

  return (
    <section className="mb-6">
      <AppList tone="provider">
        <AppListRow
          tone="provider"
          title="Network value"
          description={parts.join(" · ")}
          leading={
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}18` }}>
              <Share2 size={18} style={{ color: CSP_PRIMARY_BUTTON }} />
            </div>
          }
          onClick={() => navigate(cspRouteForContext(pathname, "/csp/dashboard/affiliate"))}
        />
      </AppList>
    </section>
  );
}
