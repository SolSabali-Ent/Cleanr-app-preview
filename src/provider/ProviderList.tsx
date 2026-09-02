// src/provider/ProviderList.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProviderContext } from "./ProviderContext";
import { ProviderCard } from "./ProviderCard";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "../components/ui/Button";
import { useSafeBack } from "../hooks/useSafeBack";

export function ProviderList() {
  const navigate = useNavigate();
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
      navigate("/app/provider");
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

      <h1 className="text-xl font-semibold mb-1">Browse providers</h1>
      <p className="text-xs text-[#667085] mb-4">
        View CSPs currently available through the Cleanr marketplace. Browsing does not assign a CSP to a booking. Existing service relationships remain visible separately even if a CSP is no longer accepting new marketplace work.
      </p>

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

      <div className="fixed inset-x-0 bottom-24 flex justify-center pointer-events-none z-10">
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
              {pendingSelectionId === selectedProvider?.id
                ? "View this CSP"
                : "View selected CSP"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
