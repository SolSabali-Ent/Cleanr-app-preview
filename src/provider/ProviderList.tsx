// src/provider/ProviderList.tsx
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useProviderContext } from "./ProviderContext";
import { ProviderCard } from "./ProviderCard";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "../components/ui/Button";
import { useSafeBack } from "../hooks/useSafeBack";
import { customerRouteForContext } from "../lib/contextualRoutes";

export function ProviderList() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const goBack = useSafeBack("/app/provider", "/admin/full-app/customer/provider");
  const { providers, selectedProvider, selectProvider } = useProviderContext();
  const browseableProviders = useMemo(
    () => providers.filter((provider) => provider.marketplace_access === true),
    [providers]
  );
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(
    selectedProvider?.marketplace_access ? selectedProvider.id : null
  );

  const handleConfirm = () => {
    if (pendingSelectionId) {
      selectProvider(pendingSelectionId);
      navigate(customerRouteForContext(pathname, "/app/provider"));
    }
  };

  return (
    <div className="text-[#0B1220] pb-32">
      <Button
        onClick={goBack}
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="w-3 h-3" />}
        className="mb-3 !px-0 text-[#667085]"
      >
        Back
      </Button>

      <header className="mb-4">
        <h1 className="text-xl font-semibold">Browse CSPs</h1>
        <p className="mt-1 text-sm text-[#667085]">Choose someone you want to learn more about.</p>
      </header>

      {browseableProviders.length === 0 ? (
        <div className="border-y border-[#E4E7EC] py-6 text-center">
          <p className="text-sm font-semibold">No CSPs are available right now.</p>
          <p className="mt-1 text-sm text-[#667085]">You can still book and let Cleanr match around your service and schedule.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {browseableProviders.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              isSelected={pendingSelectionId === p.id}
              onClick={() => setPendingSelectionId(p.id)}
            />
          ))}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-4 text-[#98A2B3]">
        Browsing does not assign a CSP to a booking. Exact availability is confirmed when you choose your service, place, date, and time.
      </p>

      <div className="fixed inset-x-0 bottom-24 z-10 flex justify-center pointer-events-none">
        <div className="w-full max-w-[720px] px-4">
          <div className="pointer-events-auto">
            <Button
              disabled={!pendingSelectionId}
              onClick={handleConfirm}
              variant={pendingSelectionId ? "primaryGreen" : "secondary"}
              size="lg"
              fullWidth
              leftIcon={<Check className="w-3 h-3" />}
            >
              {pendingSelectionId === selectedProvider?.id ? "View this CSP" : "View selected CSP"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
