// src/provider/ProviderList.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProviderContext } from "./ProviderContext";
import { ProviderCard } from "./ProviderCard";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "../components/ui/Button";

export function ProviderList() {
  const navigate = useNavigate();
  const { providers, selectedProvider, selectProvider } = useProviderContext();
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(
    selectedProvider?.id ?? null
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
        onClick={() => navigate(-1)}
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="w-3 h-3" />}
        className="mb-3 !px-0 text-[#667085]"
      >
        Back
      </Button>

      <h1 className="text-xl font-semibold mb-1">Choose your provider</h1>
      <p className="text-xs text-[#667085] mb-4">
        Pick the Cleanr Service Provider that best fits your home and schedule.
      </p>

      <div className="space-y-2">
        {providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            isSelected={pendingSelectionId === p.id}
            onClick={() => setPendingSelectionId(p.id)}
          />
        ))}
      </div>

      {/* Sticky confirmation bar */}
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
                ? "Keep this provider"
                : "Choose this provider"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

