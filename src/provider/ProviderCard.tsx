// src/provider/ProviderCard.tsx
import { useEffect, useState } from "react";
import { Star, UsersRound } from "lucide-react";
import { getSignedProfilePhotoUrl } from "../lib/profilePhotoApi";
import type { PublicProvider } from "./types";
import { providerDisplayName } from "./types";

interface ProviderCardProps {
  provider: PublicProvider;
  isSelected?: boolean;
  onClick?: () => void;
}

export function ProviderCard({ provider, isSelected, onClick }: ProviderCardProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getSignedProfilePhotoUrl(provider.profile_photo_path).then((url) => {
      if (active) setPhotoUrl(url);
    });
    return () => { active = false; };
  }, [provider.profile_photo_path]);

  const name = providerDisplayName(provider);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left border rounded-[20px] p-3 flex gap-3 transition
        ${isSelected ? "border-[#8DCC64] bg-[#F3FAF1]" : "border-[#E5E7EB] bg-white"}
      `}
    >
      <div className="w-14 h-14 overflow-hidden rounded-full bg-[#F1F5F9] border border-[#E5E7EB] text-[#0B1220] flex-shrink-0 flex items-center justify-center text-sm font-semibold">
        {photoUrl ? <img src={photoUrl} alt={`${name} profile`} className="h-full w-full object-cover" /> : name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#0B1220]">{name}</p>
            {typeof provider.avg_rating === "number" && (provider.review_count ?? 0) > 0 ? (
              <p className="text-xs text-[#667085] mt-0.5 flex items-center gap-1">
                <Star className="w-3 h-3 text-[#8DCC64]" />
                {provider.avg_rating.toFixed(1)} · {provider.review_count} reviews
              </p>
            ) : null}
          </div>
          {provider.marketplace_access ? <span className="provider-badge font-semibold">Active</span> : null}
        </div>

        {provider.provider_bio ? <p className="mt-2 line-clamp-2 text-xs leading-4 text-[#667085]">{provider.provider_bio}</p> : null}

        <div className="flex flex-wrap gap-1 mt-2">
          {provider.background_checked ? <span className="provider-badge">Background Checked</span> : null}
          {provider.insured ? <span className="provider-badge">Insured</span> : null}
          {provider.platform_verified ? <span className="provider-badge">Cleanr Verified</span> : null}
          {(provider.repeat_household_count ?? 0) > 0 ? <span className="provider-badge inline-flex items-center gap-1"><UsersRound className="h-3 w-3" /> {provider.repeat_household_count} repeat</span> : null}
        </div>

        {(provider.specialties?.length ?? 0) > 0 ? <p className="mt-2 text-[11px] text-[#667085]">Known for {provider.specialties.slice(0, 3).join(" · ")}</p> : null}
      </div>
    </button>
  );
}
