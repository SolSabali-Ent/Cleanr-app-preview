import { useEffect, useState } from "react";
import {
  getProviderPresenceSummary,
  listMarketplaceProvidersForZip,
  type MarketplaceProviderChoice,
  type ProviderPresenceSummary,
} from "@/lib/providerPresence";

type ProviderPresenceStripProps = {
  zip?: string | null;
  className?: string;
  compact?: boolean;
  interactive?: boolean;
  confirmed?: boolean;
  selectedProviderId?: string | null;
  onSelectProvider?: (provider: MarketplaceProviderChoice | null) => void;
};

function formatProviderName(name: string | null, preferredName?: string | null): string {
  return preferredName?.trim() || name?.trim() || "Cleanr Service Professional";
}

export function ProviderPresenceStrip({
  zip,
  className,
  compact = false,
  interactive = false,
  confirmed = false,
  selectedProviderId = null,
  onSelectProvider,
}: ProviderPresenceStripProps) {
  const [summary, setSummary] = useState<ProviderPresenceSummary | null>(null);
  const [providers, setProviders] = useState<MarketplaceProviderChoice[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const normalizedZip = zip?.trim() || null;
    setLoading(true);

    const summaryPromise = getProviderPresenceSummary({ zip: normalizedZip, sampleLimit: compact ? 2 : 3 });
    const providersPromise = interactive && confirmed && normalizedZip
      ? listMarketplaceProvidersForZip(normalizedZip, compact ? 4 : 6)
      : Promise.resolve([] as MarketplaceProviderChoice[]);

    void Promise.all([summaryPromise, providersPromise])
      .then(([nextSummary, nextProviders]) => {
        if (!mounted) return;
        setSummary(nextSummary);
        setProviders(nextProviders);
      })
      .catch(() => {
        if (!mounted) return;
        setSummary(null);
        setProviders([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [zip, compact, interactive, confirmed]);

  const containerClass = className
    ? `rounded-2xl border border-[#E5E7EB] bg-white p-4 ${className}`
    : "rounded-2xl border border-[#E5E7EB] bg-white p-4";

  const displayProviders = interactive && confirmed ? providers : [];

  return (
    <section className={containerClass} aria-live="polite">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#166534]">
        Availability
      </p>
      <h3 className="mt-1 text-[15px] font-semibold text-[#0B1220]">
        {interactive && confirmed ? "Choose a CSP, or let Cleanr match you." : "Check booking availability in your area."}
      </h3>

      {loading ? (
        <p className="mt-2 text-[12px] text-[#667085]">Checking provider coverage...</p>
      ) : null}

      {!loading && summary ? (
        <>
          {summary.zip_supported === false ? (
            <p className="mt-2 text-[12px] text-[#667085]">
              Cleanr is not open for booking in this ZIP yet.
            </p>
          ) : summary.has_provider_coverage ? (
            <p className="mt-2 text-[12px] text-[#667085]">
              Cleanr is available in your area{summary.searched_zip ? ` (${summary.searched_zip})` : ""}.
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-[#667085]">
              Cleanr is preparing coverage in this area.
            </p>
          )}

          {interactive && confirmed && displayProviders.length > 0 ? (
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => onSelectProvider?.(null)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                  !selectedProviderId
                    ? "border-[#8DCC64] bg-[#F3FAF1]"
                    : "border-[#E5E7EB] bg-[#F8FAFC]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-[#0B1220]">Let Cleanr match me</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#667085]">We’ll use your address, service needs, and chosen time to find an eligible CSP.</p>
                  </div>
                  {!selectedProviderId ? <span className="text-lg text-[#166534]" aria-hidden>✓</span> : null}
                </div>
              </button>

              {displayProviders.map((provider) => {
                const selected = selectedProviderId === provider.id;
                const expanded = expandedId === provider.id;
                const displayName = formatProviderName(provider.full_name, provider.preferred_name);
                return (
                  <div
                    key={provider.id}
                    className={`rounded-xl border px-3 py-3 transition-colors ${
                      selected ? "border-[#8DCC64] bg-[#F3FAF1]" : "border-[#E5E7EB] bg-[#F8FAFC]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProvider?.(provider)}
                      className="w-full text-left"
                      aria-pressed={selected}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-[#0B1220]">{displayName}</p>
                          <p className="mt-0.5 text-[11px] text-[#667085]">
                            {provider.avg_rating !== null && provider.review_count > 0
                              ? `⭐ ${provider.avg_rating.toFixed(1)} · ${provider.review_count} reviews`
                              : "New to marketplace"}
                          </p>
                        </div>
                        {selected ? <span className="text-lg text-[#166534]" aria-hidden>✓</span> : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {provider.background_checked ? <span className="provider-badge">Background Checked</span> : null}
                        {provider.insured ? <span className="provider-badge">Insured</span> : null}
                        {provider.platform_verified ? <span className="provider-badge">Platform Verified</span> : null}
                      </div>
                    </button>

                    {(provider.provider_bio || provider.specialties.length > 0 || provider.years_experience !== null || provider.repeat_household_count > 0) ? (
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : provider.id)}
                        className="mt-2 text-[11px] font-semibold text-[#166534] underline underline-offset-2"
                      >
                        {expanded ? "Show less" : `About ${displayName}`}
                      </button>
                    ) : null}

                    {expanded ? (
                      <div className="mt-2 border-t border-[#DDE7D6] pt-2 text-[11px] leading-4 text-[#475467]">
                        {provider.provider_bio ? <p>{provider.provider_bio}</p> : null}
                        {provider.years_experience !== null ? <p className="mt-1">{provider.years_experience} year{provider.years_experience === 1 ? "" : "s"} of cleaning experience</p> : null}
                        {provider.repeat_household_count > 0 ? <p className="mt-1">{provider.repeat_household_count} repeat household{provider.repeat_household_count === 1 ? "" : "s"}</p> : null}
                        {provider.specialties.length > 0 ? <p className="mt-1">Strengths: {provider.specialties.slice(0, 4).join(", ")}</p> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <p className="pt-1 text-[11px] leading-4 text-[#667085]">
                Choosing a CSP is a request, not a guarantee yet. Cleanr will confirm the exact address and date/time work for that CSP before payment begins.
              </p>
            </div>
          ) : null}

          {!interactive && summary.sample_providers.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {summary.sample_providers.map((provider) => (
                <div key={provider.id} className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2">
                  <p className="text-[13px] font-medium text-[#0B1220]">{formatProviderName(provider.full_name)}</p>
                  <p className="mt-0.5 text-[11px] text-[#667085]">
                    {provider.avg_rating !== null && provider.review_count > 0
                      ? `⭐ ${provider.avg_rating.toFixed(1)} · ${provider.review_count} reviews`
                      : "New to marketplace"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {provider.background_checked ? <span className="provider-badge">Background Checked</span> : null}
                    {provider.insured ? <span className="provider-badge">Insured</span> : null}
                    {provider.platform_verified ? <span className="provider-badge">Platform Verified</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {!loading && !summary ? (
        <p className="mt-2 text-[12px] text-[#667085]">Cleanr availability is being prepared for this area.</p>
      ) : null}
    </section>
  );
}
