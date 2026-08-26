// src/provider/ProviderCard.tsx
import { Star } from "lucide-react";
import type { PublicProvider } from "./types";
import { providerDisplayName } from "./types";

interface ProviderCardProps {
  provider: PublicProvider;
  isSelected?: boolean;
  onClick?: () => void;
}

export function ProviderCard({ provider, isSelected, onClick }: ProviderCardProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border rounded-[20px] p-3 flex gap-3 transition
        ${isSelected ? "border-[#8DCC64] bg-[#F3FAF1]" : "border-[#E5E7EB] bg-white"}
      `}
    >
      <div className="w-12 h-12 rounded-full bg-[#F1F5F9] border border-[#E5E7EB] text-[#0B1220] flex-shrink-0 flex items-center justify-center text-sm font-semibold">
        {providerDisplayName(provider).charAt(0)}
      </div>
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#0B1220]">{providerDisplayName(provider)}</p>
            {typeof provider.avg_rating === "number" && (provider.review_count ?? 0) > 0 ? (
              <p className="text-xs text-[#667085] mt-0.5 flex items-center gap-1">
                <Star className="w-3 h-3 text-[#8DCC64]" />
                {provider.avg_rating.toFixed(1)} · {provider.review_count} reviews
              </p>
            ) : null}
          </div>
          {provider.marketplace_access ? <span className="provider-badge font-semibold">Active</span> : null}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {provider.background_checked ? <span className="provider-badge">Background Checked</span> : null}
          {provider.insured ? <span className="provider-badge">Insured</span> : null}
          {provider.platform_verified ? <span className="provider-badge">Platform Verified</span> : null}
        </div>
      </div>
    </button>
  );
}

