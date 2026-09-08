import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Search, ShieldCheck, Star, X } from "lucide-react";
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

function ProviderBadges({ provider }: { provider: MarketplaceProviderChoice }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {provider.background_checked ? <span className="provider-badge">Background Checked</span> : null}
      {provider.insured ? <span className="provider-badge">Insured</span> : null}
      {provider.platform_verified ? <span className="provider-badge">Platform Verified</span> : null}
    </div>
  );
}

function ProviderSignal({ provider }: { provider: MarketplaceProviderChoice }) {
  if (provider.avg_rating !== null && provider.review_count > 0) {
    return (
      <span className="inline-flex items-center gap-1">
        <Star className="h-3.5 w-3.5 text-[#8DCC64]" />
        {provider.avg_rating.toFixed(1)} · {provider.review_count} review{provider.review_count === 1 ? "" : "s"}
      </span>
    );
  }
  return <span>New to marketplace</span>;
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
  const [previewProviders, setPreviewProviders] = useState<MarketplaceProviderChoice[]>([]);
  const [allProviders, setAllProviders] = useState<MarketplaceProviderChoice[]>([]);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [chooserLoading, setChooserLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const normalizedZip = zip?.trim() || null;
    setLoading(true);
    setExpandedId(null);

    const summaryPromise = getProviderPresenceSummary({ zip: normalizedZip, sampleLimit: compact ? 2 : 3 });
    const providersPromise = interactive && confirmed && normalizedZip
      ? listMarketplaceProvidersForZip(normalizedZip, compact ? 2 : 3)
      : Promise.resolve([] as MarketplaceProviderChoice[]);

    void Promise.all([summaryPromise, providersPromise])
      .then(async ([nextSummary, nextProviders]) => {
        if (!mounted) return;
        setSummary(nextSummary);
        setPreviewProviders(nextProviders);

        if (selectedProviderId && !nextProviders.some((provider) => provider.id === selectedProviderId) && normalizedZip) {
          try {
            const broader = await listMarketplaceProvidersForZip(normalizedZip, 50);
            if (!mounted) return;
            setAllProviders(broader);
          } catch {
            if (mounted) setAllProviders([]);
          }
        } else {
          setAllProviders([]);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSummary(null);
        setPreviewProviders([]);
        setAllProviders([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [zip, compact, interactive, confirmed, selectedProviderId]);

  useEffect(() => {
    if (!chooserOpen) return;
    const normalizedZip = zip?.trim();
    if (!normalizedZip) return;
    let mounted = true;
    setChooserLoading(true);
    void listMarketplaceProvidersForZip(normalizedZip, 50)
      .then((providers) => {
        if (mounted) setAllProviders(providers);
      })
      .catch(() => {
        if (mounted) setAllProviders([]);
      })
      .finally(() => {
        if (mounted) setChooserLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [chooserOpen, zip]);

  useEffect(() => {
    if (!chooserOpen || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [chooserOpen]);

  const selectedProvider = useMemo(() => {
    if (!selectedProviderId) return null;
    return [...previewProviders, ...allProviders].find((provider) => provider.id === selectedProviderId) ?? null;
  }, [selectedProviderId, previewProviders, allProviders]);

  const filteredProviders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allProviders;
    return allProviders.filter((provider) => {
      const haystack = [
        provider.full_name,
        provider.preferred_name,
        provider.provider_bio,
        ...provider.specialties,
        ...provider.service_area_labels,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [allProviders, searchQuery]);

  const selectProvider = (provider: MarketplaceProviderChoice | null, closeChooser = false) => {
    onSelectProvider?.(provider);
    setExpandedId(null);
    if (closeChooser) setChooserOpen(false);
  };

  const containerClass = className
    ? `rounded-2xl border border-[#E5E7EB] bg-white p-4 ${className}`
    : "rounded-2xl border border-[#E5E7EB] bg-white p-4";

  return (
    <>
      <section className={containerClass} aria-live="polite">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#166534]">Availability</p>
        <h3 className="mt-1 text-[15px] font-semibold text-[#0B1220]">
          {interactive && confirmed ? "Choose a CSP, or let Cleanr match you." : "Check booking availability in your area."}
        </h3>

        {loading ? <p className="mt-2 text-[12px] text-[#667085]">Checking provider coverage...</p> : null}

        {!loading && summary ? (
          <>
            {summary.zip_supported === false ? (
              <p className="mt-2 text-[12px] text-[#667085]">Cleanr is not open for booking in this ZIP yet.</p>
            ) : summary.has_provider_coverage ? (
              <p className="mt-2 text-[12px] text-[#667085]">
                Cleanr is available in your area{summary.searched_zip ? ` (${summary.searched_zip})` : ""}.
              </p>
            ) : (
              <p className="mt-2 text-[12px] text-[#667085]">Cleanr is preparing coverage in this area.</p>
            )}

            {interactive && confirmed && summary.has_provider_coverage ? (
              selectedProviderId ? (
                <div className="mt-3 rounded-xl border border-[#8DCC64] bg-[#F3FAF1] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#166534]">Requested CSP</p>
                      <p className="mt-1 text-[15px] font-semibold text-[#0B1220]">
                        {selectedProvider
                          ? formatProviderName(selectedProvider.full_name, selectedProvider.preferred_name)
                          : "Your selected CSP"}
                      </p>
                      {selectedProvider ? (
                        <p className="mt-0.5 text-[11px] text-[#667085]"><ProviderSignal provider={selectedProvider} /></p>
                      ) : null}
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#166534]">
                      <Check className="h-5 w-5" />
                    </span>
                  </div>
                  {selectedProvider ? <ProviderBadges provider={selectedProvider} /> : null}
                  <div className="mt-3 flex items-center gap-4">
                    {selectedProvider ? (
                      <button type="button" onClick={() => { setChooserOpen(true); setExpandedId(selectedProvider.id); }} className="text-[12px] font-semibold text-[#166534] underline underline-offset-2">
                        View profile
                      </button>
                    ) : null}
                    <button type="button" onClick={() => setChooserOpen(true)} className="text-[12px] font-semibold text-[#0000FE] underline underline-offset-2">
                      Change CSP
                    </button>
                    <button type="button" onClick={() => selectProvider(null)} className="text-[12px] font-semibold text-[#667085] underline underline-offset-2">
                      Let Cleanr match
                    </button>
                  </div>
                  <p className="mt-3 text-[11px] leading-4 text-[#667085]">We’ll confirm this CSP works for your exact address and chosen date/time before payment.</p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => selectProvider(null)}
                    className="w-full rounded-xl border border-[#8DCC64] bg-[#F3FAF1] px-3 py-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold text-[#0B1220]">Let Cleanr match me</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-[#667085]">We’ll use your address, service needs, and chosen time to find an eligible CSP.</p>
                      </div>
                      <Check className="h-5 w-5 shrink-0 text-[#166534]" />
                    </div>
                  </button>

                  {previewProviders.map((provider) => {
                    const displayName = formatProviderName(provider.full_name, provider.preferred_name);
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => selectProvider(provider)}
                        className="w-full rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-3 text-left transition-colors hover:border-[#CFE8C2] hover:bg-[#F7FBF5]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#0B1220]">{displayName}</p>
                            <p className="mt-0.5 text-[11px] text-[#667085]"><ProviderSignal provider={provider} /></p>
                          </div>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[#98A2B3]" />
                        </div>
                        <ProviderBadges provider={provider} />
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setChooserOpen(true)}
                    className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[#DDE7F5] bg-white px-3 py-2.5 text-left text-[12px] font-semibold text-[#0000FE]"
                  >
                    <span>View all CSPs in {zip}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>

                  <p className="pt-1 text-[11px] leading-4 text-[#667085]">You can change your CSP request anytime before payment.</p>
                </div>
              )
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

        {!loading && !summary ? <p className="mt-2 text-[12px] text-[#667085]">Cleanr availability is being prepared for this area.</p> : null}
      </section>

      {chooserOpen ? (
        <div className="fixed inset-0 z-[100] bg-[#F7F9FC]" role="dialog" aria-modal="true" aria-label={`Choose a Cleanr CSP in ${zip ?? "your area"}`}>
          <div className="mx-auto flex h-full w-full max-w-[720px] flex-col bg-white">
            <header className="shrink-0 border-b border-[#E5E7EB] bg-white px-4 pb-3 pt-[max(16px,env(safe-area-inset-top))]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#166534]">CSPs in {zip}</p>
                  <h2 className="mt-1 text-[20px] font-semibold text-[#0B1220]">Choose someone who feels like a fit</h2>
                </div>
                <button type="button" onClick={() => setChooserOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-white" aria-label="Close CSP chooser">
                  <X className="h-5 w-5 text-[#0B1220]" />
                </button>
              </div>
              <p className="mt-2 text-[12px] leading-5 text-[#667085]">Browse now. Exact availability is confirmed after you choose your service, address, date, and time.</p>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98A2B3]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by name, specialty, or area"
                  className="w-full rounded-xl border border-[#DDE2EA] bg-[#F8FAFC] py-3 pl-9 pr-3 text-sm text-[#0B1220] outline-none focus:border-[#0000FE] focus:ring-2 focus:ring-[#0000FE]/10"
                />
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <button
                type="button"
                onClick={() => selectProvider(null, true)}
                className={`mb-3 w-full rounded-2xl border p-4 text-left ${!selectedProviderId ? "border-[#8DCC64] bg-[#F3FAF1]" : "border-[#E5E7EB] bg-white"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold text-[#0B1220]">Let Cleanr match me</p>
                    <p className="mt-1 text-[12px] leading-5 text-[#667085]">Best if you care more about the right time and service fit than choosing a specific CSP.</p>
                  </div>
                  {!selectedProviderId ? <Check className="h-5 w-5 shrink-0 text-[#166534]" /> : null}
                </div>
              </button>

              {chooserLoading ? <p className="py-8 text-center text-sm text-[#667085]">Loading CSPs in your area...</p> : null}

              {!chooserLoading && filteredProviders.length === 0 ? (
                <div className="rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-5 text-center">
                  <p className="text-sm font-semibold text-[#0B1220]">No CSPs match that search.</p>
                  <p className="mt-1 text-xs text-[#667085]">Try a different name or specialty.</p>
                </div>
              ) : null}

              <div className="space-y-3">
                {filteredProviders.map((provider) => {
                  const selected = selectedProviderId === provider.id;
                  const expanded = expandedId === provider.id;
                  const displayName = formatProviderName(provider.full_name, provider.preferred_name);
                  return (
                    <article key={provider.id} className={`rounded-2xl border p-4 ${selected ? "border-[#8DCC64] bg-[#F7FBF5]" : "border-[#E5E7EB] bg-white"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[16px] font-semibold text-[#0B1220]">{displayName}</p>
                          <p className="mt-1 text-[12px] text-[#667085]"><ProviderSignal provider={provider} /></p>
                        </div>
                        {selected ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F6E1] text-[#166534]"><Check className="h-5 w-5" /></span> : null}
                      </div>

                      <ProviderBadges provider={provider} />

                      {(provider.years_experience !== null || provider.repeat_household_count > 0 || provider.specialties.length > 0) ? (
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#667085]">
                          {provider.years_experience !== null ? <span>{provider.years_experience}y experience</span> : null}
                          {provider.repeat_household_count > 0 ? <span>{provider.repeat_household_count} repeat household{provider.repeat_household_count === 1 ? "" : "s"}</span> : null}
                          {provider.specialties.length > 0 ? <span>{provider.specialties.slice(0, 2).join(" · ")}</span> : null}
                        </div>
                      ) : null}

                      {expanded ? (
                        <div className="mt-3 rounded-xl bg-[#F8FAFC] p-3 text-[12px] leading-5 text-[#475467]">
                          {provider.provider_bio ? <p>{provider.provider_bio}</p> : <p>This CSP has not added an introduction yet.</p>}
                          {provider.specialties.length > 0 ? <p className="mt-2"><span className="font-semibold text-[#0B1220]">Strengths:</span> {provider.specialties.slice(0, 6).join(", ")}</p> : null}
                          {provider.service_area_labels.length > 0 ? <p className="mt-2"><span className="font-semibold text-[#0B1220]">Areas served:</span> {provider.service_area_labels.slice(0, 6).join(", ")}</p> : null}
                          <div className="mt-2 flex items-center gap-1.5 text-[#166534]"><ShieldCheck className="h-4 w-4" /><span className="font-medium">Exact service eligibility is verified before payment.</span></div>
                        </div>
                      ) : null}

                      <div className="mt-4 flex items-center gap-2">
                        <button type="button" onClick={() => setExpandedId(expanded ? null : provider.id)} className="min-h-11 flex-1 rounded-xl border border-[#DDE2EA] bg-white px-3 text-[12px] font-semibold text-[#0B1220]">
                          {expanded ? "Hide profile" : "View profile"}
                        </button>
                        <button type="button" onClick={() => selectProvider(provider, true)} className="min-h-11 flex-1 rounded-xl bg-[#0000FE] px-3 text-[12px] font-semibold text-white">
                          {selected ? "Keep this CSP" : "Choose this CSP"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <footer className="shrink-0 border-t border-[#E5E7EB] bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
              <p className="text-center text-[11px] leading-4 text-[#667085]">Choosing a CSP is a request until Cleanr confirms the exact address and date/time work for that CSP.</p>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
