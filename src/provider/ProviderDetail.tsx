import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Languages, MapPin, ShieldCheck, Sparkles, Star, UsersRound } from "lucide-react";
import { Button } from "../components/ui/Button";
import { getSignedProfilePhotoUrl } from "../lib/profilePhotoApi";
import { supabase } from "../lib/supabase";
import { getMyServiceRelationshipWithProvider } from "../lib/serviceRelationshipApi";
import { providerDisplayName } from "./types";
import { isUuid } from "@/utils/isUuid";
import { useSafeBack } from "../hooks/useSafeBack";

type PublicProviderProfile = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  profile_photo_path: string | null;
  provider_bio: string | null;
  years_experience: number | null;
  languages: string[] | null;
  specialties: string[] | null;
  service_area_labels: string[] | null;
  repeat_household_count: number | null;
  service_radius_miles: number | null;
  marketplace_access: boolean | null;
  created_at: string | null;
  background_checked: boolean | null;
  insured: boolean | null;
  platform_verified: boolean | null;
  metrics?: {
    avg_rating: number | null;
    review_count: number | null;
    completed_jobs: number | null;
    years_active: number | null;
  } | null;
};

type ProviderReview = {
  rating: number;
  comment: string | null;
  created_at: string;
};

type RelationshipStatus = "active" | "paused" | null;

export function ProviderDetail() {
  const { providerId } = useParams<{ providerId: string }>();
  const navigate = useNavigate();
  const goBack = useSafeBack("/app/provider/list", "/admin/full-app/customer/provider/list");
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProviderProfile | null>(null);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [reviews, setReviews] = useState<ProviderReview[]>([]);

  const bookingId = searchParams.get("bookingId");
  const isValidProviderId = isUuid(providerId);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!providerId || !isValidProviderId) {
        setLoading(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        setLoading(false);
        return;
      }

      const [{ data: provider, error: providerError }, { data: metrics, error: metricsError }, reviewResult] = await Promise.all([
        supabase.from("provider_public_profiles").select("*").eq("id", providerId).single(),
        supabase.from("provider_metrics").select("avg_rating, review_count, completed_jobs, years_active").eq("id", providerId).single(),
        supabase.rpc("get_provider_public_reviews", { p_provider_id: providerId, p_limit: 5 }),
      ]);

      let durableRelationshipId: string | null = null;
      let durableRelationshipStatus: RelationshipStatus = null;
      try {
        const relationship = await getMyServiceRelationshipWithProvider(providerId);
        durableRelationshipStatus = relationship?.status === "active" || relationship?.status === "paused"
          ? relationship.status
          : null;
        durableRelationshipId = durableRelationshipStatus === "active" ? relationship?.id ?? null : null;
      } catch {
        durableRelationshipId = null;
        durableRelationshipStatus = null;
      }

      if (!active) return;
      setRelationshipId(durableRelationshipId);
      setRelationshipStatus(durableRelationshipStatus);
      setReviews(reviewResult.error ? [] : ((reviewResult.data ?? []) as ProviderReview[]));

      if (providerError || !provider) {
        setProfile(null);
        setPhotoUrl(null);
      } else {
        const data = {
          ...(provider as Record<string, unknown>),
          metrics: metricsError ? null : (metrics as Record<string, unknown>),
        } as PublicProviderProfile;
        setProfile(data);
        setPhotoUrl(await getSignedProfilePhotoUrl(data.profile_photo_path));
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [providerId, isValidProviderId]);

  const memberSinceYear = useMemo(() => {
    if (!profile?.created_at) return "—";
    const year = new Date(profile.created_at).getFullYear();
    return Number.isFinite(year) ? String(year) : "—";
  }, [profile?.created_at]);

  const rating = profile?.metrics?.avg_rating ?? null;
  const reviewCount = profile?.metrics?.review_count ?? 0;
  const completedJobs = profile?.metrics?.completed_jobs ?? null;
  const repeatHouseholds = profile?.repeat_household_count ?? 0;
  const experienceYears = profile?.years_experience ?? profile?.metrics?.years_active ?? null;
  const trustBadges = [
    rating !== null && rating >= 4.8 ? "Top Rated" : null,
    profile?.background_checked ? "Background Checked" : null,
    profile?.insured ? "Provider insurance verified" : null,
    profile?.platform_verified ? "Cleanr Verified" : null,
    profile?.marketplace_access ? "Active in your area" : null,
  ].filter((item): item is string => Boolean(item));

  if (!isValidProviderId) {
    return <div className="text-sm text-[#667085]">Invalid provider ID</div>;
  }

  if (loading) {
    return <p className="text-sm text-[#667085]">Loading provider profile...</p>;
  }

  if (!profile) {
    return (
      <div className="text-[#0B1220]">
        <Button onClick={goBack} variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3 h-3" />} className="mb-3 !px-0 text-[#667085]">Back</Button>
        <p className="text-sm">Provider profile not found.</p>
      </div>
    );
  }

  const displayName = providerDisplayName(profile);

  return (
    <div className="pb-28 text-[#0B1220]">
      <Button onClick={goBack} variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3 h-3" />} className="mb-3 !px-0 text-[#667085]">Back</Button>

      <section className="mb-3 overflow-hidden rounded-xl border border-[#E5E7EB]">
        <div className="relative min-h-[190px] bg-gradient-to-br from-[#0B1220] to-[#334155] px-4 py-5">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,#8DCC64_0%,transparent_40%)]" />
          <div className="relative z-10 flex items-end gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/40 bg-white/10 text-xl font-semibold text-white">
              {photoUrl ? <img src={photoUrl} alt={`${displayName} profile`} className="h-full w-full object-cover" /> : displayName.charAt(0)}
            </div>
            <div className="min-w-0 pb-1">
              <h1 className="text-[24px] font-semibold leading-tight text-white">{displayName}</h1>
              {profile.preferred_name && profile.full_name && profile.preferred_name.trim() !== profile.full_name.trim() ? <p className="mt-0.5 text-xs text-white/65">{profile.full_name}</p> : null}
              {reviewCount > 0 && rating !== null ? (
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-white/90"><Star className="h-4 w-4 text-[#8DCC64]" />{rating.toFixed(1)} · {reviewCount} reviews</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-3 flex flex-wrap gap-2">
        {trustBadges.map((badge) => <span key={badge} className="inline-flex items-center gap-1 rounded-full border border-[#CFE8C2] bg-[#F3FAF1] px-3 py-1 text-[12px] font-medium text-[#166534]"><ShieldCheck className="h-3 w-3 text-[#8DCC64]" />{badge}</span>)}
      </section>

      <section className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-center shadow-sm"><p className="text-lg font-semibold text-[#0B1220]">{completedJobs ?? 0}</p><p className="text-xs text-[#667085]">Completed cleans</p></div>
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-center shadow-sm"><p className="text-lg font-semibold text-[#0B1220]">{repeatHouseholds}</p><p className="text-xs text-[#667085]">Repeat households</p></div>
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-center shadow-sm"><p className="text-lg font-semibold text-[#0B1220]">{experienceYears == null ? "—" : `${experienceYears}y`}</p><p className="text-xs text-[#667085]">Experience</p></div>
      </section>

      <section className="provider-card mb-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#166534]">About {displayName}</p>
        <p className="text-sm leading-6 text-[#475467]">{profile.provider_bio || "This CSP has not added an introduction yet."}</p>
      </section>

      {(profile.specialties?.length ?? 0) > 0 ? (
        <section className="provider-card mb-3">
          <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#166534]"><Sparkles className="h-3.5 w-3.5" />Cleaning strengths</p>
          <div className="flex flex-wrap gap-2">{profile.specialties!.map((item) => <span key={item} className="rounded-full bg-[#F3FAF1] px-3 py-1 text-xs font-medium text-[#166534]">{item}</span>)}</div>
        </section>
      ) : null}

      <section className="provider-card mb-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#166534]">Service info</p>
        <div className="space-y-2 text-sm">
          {(profile.languages?.length ?? 0) > 0 ? <p className="flex items-start gap-2"><Languages className="mt-0.5 h-4 w-4 shrink-0 text-[#8DCC64]" /><span><span className="text-[#667085]">Languages:</span> <span className="font-medium">{profile.languages!.join(", ")}</span></span></p> : null}
          {(profile.service_area_labels?.length ?? 0) > 0 ? <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#8DCC64]" /><span><span className="text-[#667085]">Areas served:</span> <span className="font-medium">{profile.service_area_labels!.join(", ")}</span></span></p> : null}
          <p><span className="text-[#667085]">Service radius:</span> <span className="font-medium">{profile.service_radius_miles ?? "—"} miles</span></p>
          {repeatHouseholds > 0 ? <p className="flex items-center gap-2"><UsersRound className="h-4 w-4 text-[#8DCC64]" /><span><span className="font-medium">{repeatHouseholds}</span> household{repeatHouseholds === 1 ? " has" : "s have"} booked this CSP repeatedly.</span></p> : null}
          <p><span className="text-[#667085]">Open-market availability:</span> <span className="font-medium">{profile.marketplace_access ? "Active" : "Not active yet"}</span></p>
          {relationshipStatus ? <p><span className="text-[#667085]">Your relationship:</span> <span className="font-medium capitalize">{relationshipStatus}</span></p> : null}
          <p><span className="text-[#667085]">Cleanr member since:</span> <span className="font-medium">{memberSinceYear}</span></p>
        </div>
        {(profile.service_area_labels?.length ?? 0) > 0 ? <p className="mt-3 text-[11px] leading-4 text-[#98A2B3]">Area labels describe where this CSP works. Booking eligibility still uses Cleanr’s verified location and service-radius matching.</p> : null}
      </section>

      {reviews.length > 0 ? (
        <section className="provider-card mb-3">
          <div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-wide text-[#166534]">Recent household reviews</p><span className="text-xs text-[#667085]">{reviewCount} total</span></div>
          <div className="space-y-3">
            {reviews.map((review, index) => (
              <div key={`${review.created_at}-${index}`} className="border-b border-[#E5E7EB] pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-1 text-sm font-semibold"><Star className="h-3.5 w-3.5 text-[#8DCC64]" />{review.rating}/5</span><span className="text-[11px] text-[#98A2B3]">{new Date(review.created_at).toLocaleDateString()}</span></div>
                {review.comment?.trim() ? <p className="mt-1.5 text-sm leading-5 text-[#475467]">{review.comment}</p> : <p className="mt-1.5 text-xs text-[#98A2B3]">Rating only</p>}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-24 z-10 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[720px]">
          {bookingId ? <Button variant="primaryBlue" size="lg" fullWidth onClick={() => navigate(`/app/bookings/${bookingId}`)}>View Booking</Button>
          : relationshipStatus === "active" && relationshipId ? <Button variant="primaryGreen" size="lg" fullWidth onClick={() => navigate(`/book?relationship=${encodeURIComponent(relationshipId)}`)}>Book another cleaning together</Button>
          : relationshipStatus === "paused" ? <Button variant="secondary" size="lg" fullWidth onClick={() => navigate("/app/relationships")}>Relationship paused · manage relationship</Button>
          : <Button variant="secondary" size="lg" fullWidth disabled>Book This Provider</Button>}
        </div>
      </div>
    </div>
  );
}
