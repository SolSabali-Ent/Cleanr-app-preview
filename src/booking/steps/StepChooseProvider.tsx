import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import BottomSheet, { type Snap } from "../../components/ui/BottomSheet";
import { supabase } from "../../lib/supabase";
import { useBooking, type BookingState } from "../bookingStore";
import { ShieldCheck, Star } from "lucide-react";
import { providerDisplayName } from "../../provider/types";
type Provider = {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  serviceRadiusMiles: number | null;
  marketplaceAccess: boolean;
  createdAt: string | null;
  backgroundChecked: boolean;
  insured: boolean;
  platformVerified: boolean;
  availableTimes?: string[];
  tags?: string[];
};


interface StepChooseProviderProps {
  onNext: () => void;
  onBack: () => void;
}

type SortKey =
  | "Recommended (AI ranked)"
  | "Best rated"
  | "Most reviews"
  | "Lowest price"
  | "Highest price"
  | "Most availability"
  | "Teams only";

type FilterState = {
  rating45Plus: boolean;
  verifiedOnly: boolean;
  ecoFriendly: boolean;
  petFriendly: boolean;
};

const PAGE_SIZE = 12;
const SORT_OPTIONS: Array<{ label: SortKey; disabled?: boolean }> = [
  { label: "Recommended (AI ranked)" },
  { label: "Best rated" },
  { label: "Most reviews" },
  { label: "Lowest price", disabled: true },
  { label: "Highest price", disabled: true },
  { label: "Most availability" },
  { label: "Teams only", disabled: true },
];

const DEFAULT_FILTERS: FilterState = {
  rating45Plus: false,
  verifiedOnly: false,
  ecoFriendly: false,
  petFriendly: false,
};

function hasBadge(provider: Provider, text: string): boolean {
  const normalized = text.toLowerCase();
  if (normalized.includes("verified")) return provider.platformVerified || provider.backgroundChecked;
  if (normalized.includes("background")) return provider.backgroundChecked;
  if (normalized.includes("insured")) return provider.insured;
  return false;
}

function hasKeyword(provider: Provider, text: string): boolean {
  const normalized = text.toLowerCase();
  if (normalized.includes("verified")) return provider.platformVerified || provider.backgroundChecked;
  if (normalized.includes("background")) return provider.backgroundChecked;
  if (normalized.includes("eco")) return provider.tags?.some((tag) => tag.toLowerCase().includes("eco")) ?? false;
  if (normalized.includes("pet")) return provider.tags?.some((tag) => tag.toLowerCase().includes("pet")) ?? false;
  return false;
}

type MatchResult = {
  score: number;
  reasons: string[];
};

type MatchProvider = Provider & {
  availableTimes?: string[];
  tags?: string[];
};

function getProviderTags(provider: MatchProvider): string[] {
  const fromTags = provider.tags ?? [];
  const fromTrust = [
    provider.backgroundChecked ? "background checked" : "",
    provider.platformVerified ? "verified" : "",
    provider.insured ? "insured" : "",
  ].filter(Boolean);
  return [...fromTags, ...fromTrust].map((item) => item.toLowerCase());
}

function computeMatchScore(provider: MatchProvider, state: BookingState): MatchResult {
  let score = 0;
  const reasons: string[] = [];
  const tags = getProviderTags(provider);
  const availableTimes = provider.availableTimes ?? [];
  const selectedTime = state.time ?? "";
  const hasPets = state.extras.some((extra) => extra.toLowerCase().includes("pet"));
  const eco = state.extras.some((extra) => extra.toLowerCase().includes("eco"));

  // 1) Rating (max 40)
  if (provider.rating) {
    score += (provider.rating / 5) * 40;
    reasons.push(`${provider.rating.toFixed(1)} star rating`);
  }

  // 2) Reviews (max 15, log scaled)
  if (provider.reviewCount) {
    score += Math.min(15, Math.log10(provider.reviewCount + 1) * 5);
    reasons.push(`${provider.reviewCount} reviews`);
  }

  // 3) Availability match (max 20)
  if (selectedTime && availableTimes.includes(selectedTime)) {
    score += 20;
    reasons.push(`Available at your selected time (${selectedTime})`);
  }

  // 4) Pet match (max 10)
  if (hasPets && tags.some((tag) => tag.includes("pet-friendly") || tag.includes("pet friendly") || tag.includes("pet"))) {
    score += 10;
    reasons.push("Pet-friendly profile match");
  }

  // 5) Eco match (max 5)
  if (eco && tags.some((tag) => tag.includes("eco"))) {
    score += 5;
    reasons.push("Eco-friendly profile match");
  }

  // 6) Availability density (max 10)
  if (availableTimes.length) {
    score += Math.min(10, availableTimes.length * 2);
    reasons.push(`${availableTimes.length} time slots available`);
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasons: reasons.slice(0, 5),
  };
}

function matchBadgeClasses(score: number): string {
  if (score >= 90) return "border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]";
  if (score >= 80) return "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]";
  return "";
}

type DetailProfile = {
  id: string;
  full_name: string | null;
  service_radius_miles: number | null;
  marketplace_access: boolean | null;
  created_at: string | null;
  avg_rating: number | null;
  review_count: number;
  background_checked: boolean | null;
  insured: boolean | null;
  platform_verified: boolean | null;
};

export function StepChooseProvider({ onNext, onBack: _onBack }: StepChooseProviderProps) {
  const { state, update } = useBooking();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("Recommended (AI ranked)");
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [detailProviderId, setDetailProviderId] = useState<string | null>(null);
  const [detailProfile, setDetailProfile] = useState<DetailProfile | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<Snap>("medium");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [activeReasonProviderId, setActiveReasonProviderId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProviders() {
      const { data } = await supabase
        .from("provider_public_profiles")
        .select("*")
        .eq("marketplace_access", true)
        .order("full_name", { ascending: true });
      if (!active) return;

      const mapped = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        name: String(row.full_name ?? "Cleaning Service Professional"),
        rating: Number(row.avg_rating ?? 0),
        reviewCount: Number(row.review_count ?? 0),
        serviceRadiusMiles: (row.service_radius_miles as number | null) ?? null,
        marketplaceAccess: Boolean(row.marketplace_access),
        createdAt: (row.created_at as string | null) ?? null,
        backgroundChecked: Boolean(row.background_checked),
        insured: Boolean(row.insured),
        platformVerified: Boolean(row.platform_verified),
      }));
      setProviders(mapped);
    }
    void loadProviders();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!detailProviderId) {
      setDetailProfile(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setDetailProfile(null);
    (async () => {
      const { data, error } = await supabase
        .from("provider_public_profiles")
        .select("id, full_name, service_radius_miles, marketplace_access, created_at, avg_rating, review_count, background_checked, insured, platform_verified")
        .eq("id", detailProviderId)
        .single();
      if (!active) return;
      setDetailLoading(false);
      if (error || !data) {
        setDetailProfile(null);
        return;
      }
      setDetailProfile({
        id: String(data.id),
        full_name: data.full_name ?? null,
        service_radius_miles: data.service_radius_miles ?? null,
        marketplace_access: data.marketplace_access ?? null,
        created_at: data.created_at ?? null,
        avg_rating: data.avg_rating ?? null,
        review_count: Number(data.review_count ?? 0),
        background_checked: data.background_checked ?? null,
        insured: data.insured ?? null,
        platform_verified: data.platform_verified ?? null,
      });
    })();
    return () => {
      active = false;
    };
  }, [detailProviderId]);

  const filteredProviders = useMemo(() => {
    return providers.filter((provider) => {
      if (filters.rating45Plus && provider.rating > 0 && provider.rating < 4.5) return false;
      if (filters.verifiedOnly && !hasKeyword(provider, "verified") && !hasKeyword(provider, "background checked")) return false;
      if (filters.ecoFriendly && !hasKeyword(provider, "eco")) return false;
      if (filters.petFriendly && !hasKeyword(provider, "pet")) return false;
      return true;
    });
  }, [filters, providers]);

  const sortedProviders = useMemo(() => {
    const withScores = filteredProviders.map((provider) => ({
      provider,
      match: computeMatchScore(provider as MatchProvider, state),
    }));

    if (sortBy === "Recommended (AI ranked)") {
      return withScores
        .sort((a, b) => b.match.score - a.match.score)
        .map((item) => item.provider);
    }

    const next = [...filteredProviders];
    if (sortBy === "Best rated") {
      next.sort((a, b) => b.rating - a.rating);
      return next;
    }
    if (sortBy === "Most reviews") {
      next.sort((a, b) => b.reviewCount - a.reviewCount);
      return next;
    }
    if (sortBy === "Most availability") {
      next.sort((a, b) => {
        const aHas = a.availableTimes?.length ? 1 : 0;
        const bHas = b.availableTimes?.length ? 1 : 0;
        return bHas - aHas;
      });
      return next;
    }
    return filteredProviders;
  }, [filteredProviders, sortBy, state]);

  const matchesByProviderId = useMemo(() => {
    const map = new Map<string, MatchResult>();
    providers.forEach((provider) => {
      map.set(provider.id, computeMatchScore(provider as MatchProvider, state));
    });
    return map;
  }, [state]);

  const recommendedProviders = useMemo(() => {
    const ranked = filteredProviders
      .map((provider) => ({
        provider,
        match: matchesByProviderId.get(provider.id) ?? computeMatchScore(provider as MatchProvider, state),
      }))
      .sort((a, b) => b.match.score - a.match.score);
    return ranked.slice(0, Math.min(2, ranked.length));
  }, [filteredProviders, matchesByProviderId, state]);

  const hasMatchData = providers.some((provider) => provider.rating > 0 || provider.reviewCount > 0);
  const showRecommended = hasMatchData && recommendedProviders.length > 0;

  const visibleProviders = useMemo(
    () => sortedProviders.slice(0, visibleCount),
    [sortedProviders, visibleCount]
  );
  const canLoadMore = visibleCount < sortedProviders.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sortBy, filters]);

  useEffect(() => {
    if (!canLoadMore) return;
    if (!listRef.current || !sentinelRef.current) return;
    if (!window.IntersectionObserver) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sortedProviders.length));
        }
      },
      { root: listRef.current, rootMargin: "80px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [canLoadMore, sortedProviders.length]);

  const handleSelectProvider = (provider: Provider) => {
    update({
      selectedProviderId: provider.id,
      selectedProviderName: provider.name,
    });
  };

  const handleContinue = () => {
    if (state.selectedProviderId) {
      onNext();
    }
  };

  const applyFilters = () => {
    setFilters(draftFilters);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setFilterOpen(false);
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const activeReasonProvider = providers.find((provider) => provider.id === activeReasonProviderId);
  const activeReasonMatch = activeReasonProvider
    ? matchesByProviderId.get(activeReasonProvider.id) ?? null
    : null;

  const renderProviderCard = (provider: Provider, showMatch: boolean) => {
    const isSelected = state.selectedProviderId === provider.id;
    const showGoodChoice = provider.rating >= 4.8 || hasBadge(provider, "top rated");
    const chips = [
      provider.backgroundChecked ? "Background Checked" : null,
      provider.insured ? "Insured" : null,
      provider.platformVerified ? "Platform Verified" : null,
    ].filter((value): value is string => Boolean(value));
    const match = matchesByProviderId.get(provider.id) ?? computeMatchScore(provider as MatchProvider, state);
    const badgeClasses = matchBadgeClasses(match.score);

    return (
      <div
        key={`${showMatch ? "rec" : "all"}-${provider.id}`}
        className="flex flex-col gap-1.5"
      >
        <button
          type="button"
          onClick={() => handleSelectProvider(provider)}
          className={`w-full rounded-[16px] border p-4 text-left transition cursor-pointer ${
            showMatch
              ? isSelected
                ? "border-[#0000FE] bg-[#EEF2FF]"
                : "border-[#BFDBFE] bg-[#F5F9FF]"
              : isSelected
                ? "border-[#0000FE] bg-[#EEF2FF]"
                : "border-[#D1D5DB] bg-white"
          }`}
        >
          <div className="flex gap-3">
            <div className="h-14 w-14 flex-shrink-0 rounded-full border border-[#E5E7EB] bg-[#F1F5F9] flex items-center justify-center text-sm font-semibold text-[#0B1220]">
              {provider.name.charAt(0)}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-bold text-[#0B1220]">{provider.name}</h3>

              {provider.reviewCount > 0 && provider.rating > 0 ? (
                <p className="mt-1 text-[13px] font-medium text-[#667085]">
                  ⭐ {provider.rating.toFixed(1)} · {provider.reviewCount} reviews
                </p>
              ) : (
                <p className="mt-1 text-[12px] text-[#667085]">New to marketplace</p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {showMatch && badgeClasses ? (
                  <span className={`rounded-[10px] border px-2 py-0.5 text-[11px] font-semibold ${badgeClasses}`}>
                    {match.score}% Match
                  </span>
                ) : null}
                {showGoodChoice ? (
                  <span className="rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-medium text-[#1D4ED8]">
                    Good Choice
                  </span>
                ) : null}
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-[10px] border border-[#E5E7EB] px-2 py-0.5 text-[11px] font-medium text-[#667085]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          {showMatch ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[44px] text-[12px] font-semibold text-[#1D4ED8] -mt-0.5"
              onClick={() => {
                setActiveReasonProviderId(provider.id);
                setSheetSnap("medium");
                setWhyOpen(true);
              }}
            >
              Why this match? ⓘ
            </Button>
          ) : <span />}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-[44px] text-[12px] font-medium text-[#667085] hover:text-[#0B1220] -mt-0.5"
            onClick={() => {
              setDetailProviderId(provider.id);
              setSheetSnap("large");
            }}
          >
            View details ›
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-[56vh] flex-col">
      <div className="mb-3">
        <p className="text-[13px] font-semibold text-[#0B1220]">
          {filteredProviders.length} cleaners available
        </p>
      </div>

      {showRecommended ? (
        <section className="mb-4">
          <div className="mb-2 border-y border-[#E5E7EB] py-2">
            <p className="text-[15px] font-semibold text-[#0B1220]">✨ Recommended for you</p>
            <p className="mt-0.5 text-[12px] text-[#667085]">
              Based on your home details and schedule.
            </p>
          </div>
          <div className="space-y-3">
            {recommendedProviders.map(({ provider }) => renderProviderCard(provider, true))}
          </div>
        </section>
      ) : null}

      <section className="mb-3 border-y border-[#E5E7EB] py-2">
        <p className="text-[14px] font-semibold text-[#0B1220]">All available cleaners</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="justify-between text-[12px]"
            onClick={() => {
              setSheetSnap("medium");
              setSortOpen(true);
            }}
          >
            <span className="truncate">
              {sortBy === "Recommended (AI ranked)" ? "Recommended" : sortBy}
            </span>
            <span aria-hidden>▾</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="justify-between text-[12px]"
            onClick={() => {
              setDraftFilters(filters);
              setSheetSnap("medium");
              setFilterOpen(true);
            }}
          >
            <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
            <span aria-hidden>▾</span>
          </Button>
        </div>
      </section>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {visibleProviders.map((provider) => renderProviderCard(provider, false))}

        {canLoadMore ? (
          <div className="pb-1 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, sortedProviders.length))}
            >
              Load more
            </Button>
          </div>
        ) : null}
        <div ref={sentinelRef} aria-hidden className="h-1" />
      </div>

      <div className="mt-3 border-t border-[#E5E7EB] pt-3">
        <Button
          onClick={handleContinue}
          disabled={!state.selectedProviderId}
          variant="primaryBlue"
          size="lg"
          fullWidth
        >
          Continue →
        </Button>
      </div>

      <BottomSheet
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        snap={sheetSnap}
        setSnap={setSheetSnap}
        title="Sort"
        subtitle="Choose how to order cleaners."
      >
        <div className="space-y-2 overflow-y-auto pb-3">
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.label}
              type="button"
              variant={sortBy === option.label ? "primaryBlue" : "secondary"}
              size="md"
              fullWidth
              disabled={Boolean(option.disabled)}
              onClick={() => {
                if (option.disabled) return;
                setSortBy(option.label);
                setSortOpen(false);
              }}
              className="justify-start"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        snap={sheetSnap}
        setSnap={setSheetSnap}
        title="Filter"
        subtitle="Refine your cleaner results."
      >
        <div className="space-y-2 overflow-y-auto pb-3">
          <Button
            type="button"
            variant={draftFilters.rating45Plus ? "primaryBlue" : "secondary"}
            size="md"
            fullWidth
            className="justify-start"
            onClick={() => setDraftFilters((prev) => ({ ...prev, rating45Plus: !prev.rating45Plus }))}
          >
            Rating 4.5+
          </Button>
          <Button
            type="button"
            variant={draftFilters.verifiedOnly ? "primaryBlue" : "secondary"}
            size="md"
            fullWidth
            className="justify-start"
            onClick={() => setDraftFilters((prev) => ({ ...prev, verifiedOnly: !prev.verifiedOnly }))}
          >
            Verified only
          </Button>
          <Button
            type="button"
            variant={draftFilters.ecoFriendly ? "primaryBlue" : "secondary"}
            size="md"
            fullWidth
            className="justify-start"
            onClick={() => setDraftFilters((prev) => ({ ...prev, ecoFriendly: !prev.ecoFriendly }))}
          >
            Eco-friendly
          </Button>
          <Button
            type="button"
            variant={draftFilters.petFriendly ? "primaryBlue" : "secondary"}
            size="md"
            fullWidth
            className="justify-start"
            onClick={() => setDraftFilters((prev) => ({ ...prev, petFriendly: !prev.petFriendly }))}
          >
            Pet-friendly
          </Button>
          <Button type="button" variant="secondary" size="md" fullWidth disabled className="justify-start">
            Price range (unavailable)
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" size="lg" fullWidth onClick={clearFilters}>
            Clear
          </Button>
          <Button type="button" variant="primaryBlue" size="lg" fullWidth onClick={applyFilters}>
            Apply
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={whyOpen}
        onClose={() => setWhyOpen(false)}
        snap={sheetSnap}
        setSnap={setSheetSnap}
        title={activeReasonProvider ? `Why we recommended ${activeReasonProvider.name}` : "Why we recommended this pro"}
        subtitle="Ranking is based on your booking details and available profile data."
      >
        <div className="space-y-2 overflow-y-auto pb-3">
          {activeReasonMatch?.reasons.length ? (
            activeReasonMatch.reasons.map((reason) => (
              <p key={reason} className="text-[13px] text-[#0B1220]">
                • {reason}
              </p>
            ))
          ) : (
            <p className="text-[13px] text-[#667085]">Not enough ranking inputs were available for a detailed explanation.</p>
          )}
        </div>
        <Button type="button" variant="primaryBlue" size="lg" fullWidth onClick={() => setWhyOpen(false)}>
          Done
        </Button>
      </BottomSheet>

      <BottomSheet
        open={!!detailProviderId}
        onClose={() => setDetailProviderId(null)}
        snap={sheetSnap}
        setSnap={setSheetSnap}
        title="Provider details"
        subtitle="View this cleaner's profile. Close to return to your booking."
      >
        <div className="overflow-y-auto pb-3 space-y-4">
          {detailLoading ? (
            <p className="text-[13px] text-[#667085]">Loading...</p>
          ) : !detailProfile ? (
            <p className="text-[13px] text-[#667085]">Could not load provider details.</p>
          ) : (
            <>
              <section className="overflow-hidden rounded-xl border border-[#E5E7EB]">
                <div className="relative min-h-[120px] bg-gradient-to-br from-[#0B1220] to-[#334155] px-4 py-4">
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,#8DCC64_0%,transparent_40%)]" />
                  <div className="relative z-10 flex items-end gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-white/10 text-base font-semibold text-white">
                      {providerDisplayName(detailProfile).charAt(0)}
                    </div>
                    <div className="pb-1">
                      <h3 className="text-[18px] font-semibold leading-tight text-white">
                        {providerDisplayName(detailProfile)}
                      </h3>
                      {detailProfile.review_count > 0 && detailProfile.avg_rating != null ? (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-white/90">
                          <Star className="h-3.5 w-3.5 text-[#8DCC64]" />
                          {detailProfile.avg_rating.toFixed(1)} · {detailProfile.review_count} reviews
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </section>
              <section className="flex flex-wrap gap-2">
                {[
                  detailProfile.avg_rating != null && detailProfile.avg_rating >= 4.8 ? "Top Rated" : null,
                  detailProfile.background_checked ? "Background Checked" : null,
                  detailProfile.insured ? "Insured" : null,
                  detailProfile.platform_verified ? "Platform Verified" : null,
                  detailProfile.marketplace_access ? "Active in your area" : null,
                ]
                  .filter((b): b is string => Boolean(b))
                  .map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center gap-1 rounded-full border border-[#CFE8C2] bg-[#F3FAF1] px-2.5 py-1 text-[11px] font-medium text-[#166534]"
                    >
                      <ShieldCheck className="h-3 w-3 text-[#8DCC64]" />
                      {badge}
                    </span>
                  ))}
              </section>
              <section className="grid grid-cols-2 gap-2 text-sm">
                {detailProfile.review_count > 0 && detailProfile.avg_rating != null ? (
                  <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-2.5 text-center">
                    <p className="text-base font-semibold text-[#0B1220]">{detailProfile.avg_rating.toFixed(1)}</p>
                    <p className="text-[11px] text-[#667085]">Rating</p>
                  </div>
                ) : null}
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-2.5 text-center">
                  <p className="text-base font-semibold text-[#0B1220]">
                    {detailProfile.service_radius_miles ?? "—"} mi
                  </p>
                  <p className="text-[11px] text-[#667085]">Service radius</p>
                </div>
              </section>
              <p className="text-[12px] text-[#667085]">
                Professional cleaning service focused on reliability and care. Close this to continue choosing your cleaner.
              </p>
            </>
          )}
        </div>
        <Button
          type="button"
          variant="primaryBlue"
          size="lg"
          fullWidth
          onClick={() => setDetailProviderId(null)}
        >
          Close
        </Button>
      </BottomSheet>
    </div>
  );
}

