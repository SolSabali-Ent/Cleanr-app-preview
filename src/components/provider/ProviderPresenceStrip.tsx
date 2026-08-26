import { useEffect, useState } from "react";
import { getProviderPresenceSummary, type ProviderPresenceSummary } from "@/lib/providerPresence";

type ProviderPresenceStripProps = {
  zip?: string | null;
  className?: string;
  compact?: boolean;
};

function formatProviderName(name: string | null): string {
  return name?.trim() || "Cleanr Service Professional";
}

export function ProviderPresenceStrip({ zip, className, compact = false }: ProviderPresenceStripProps) {
  const [summary, setSummary] = useState<ProviderPresenceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void getProviderPresenceSummary({ zip, sampleLimit: compact ? 2 : 3 })
      .then((next) => {
        if (!mounted) return;
        setSummary(next);
      })
      .catch(() => {
        if (!mounted) return;
        setSummary(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [zip, compact]);

  const containerClass = className
    ? `rounded-2xl border border-[#E5E7EB] bg-white p-4 ${className}`
    : "rounded-2xl border border-[#E5E7EB] bg-white p-4";

  return (
    <section className={containerClass} aria-live="polite">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#166534]">
        Availability
      </p>
      <h3 className="mt-1 text-[15px] font-semibold text-[#0B1220]">
        Check booking availability in your area.
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

          {summary.sample_providers.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {summary.sample_providers.map((provider) => (
                <div
                  key={provider.id}
                  className="rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2"
                >
                  <p className="text-[13px] font-medium text-[#0B1220]">
                    {formatProviderName(provider.full_name)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#667085]">
                    {provider.avg_rating !== null && provider.review_count > 0
                      ? `⭐ ${provider.avg_rating.toFixed(1)} · ${provider.review_count} reviews`
                      : "New to marketplace"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {provider.background_checked ? (
                      <span className="provider-badge">Background Checked</span>
                    ) : null}
                    {provider.insured ? <span className="provider-badge">Insured</span> : null}
                    {provider.platform_verified ? (
                      <span className="provider-badge">Platform Verified</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {!loading && !summary ? (
        <p className="mt-2 text-[12px] text-[#667085]">
          Cleanr availability is being prepared for this area.
        </p>
      ) : null}
    </section>
  );
}
