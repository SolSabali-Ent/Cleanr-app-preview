import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ShieldCheck, Star } from "lucide-react";
import { Button } from "../components/ui/Button";
import { supabase } from "../lib/supabase";
import { getMyServiceRelationshipWithProvider } from "../lib/serviceRelationshipApi";
import { providerDisplayName } from "./types";
import { isUuid } from "@/utils/isUuid";
import { useSafeBack } from "../hooks/useSafeBack";

type PublicProviderProfile = {
  id: string;
  full_name: string | null;
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

export function ProviderDetail() {
  const { providerId } = useParams<{ providerId: string }>();
  const navigate = useNavigate();
  const goBack = useSafeBack("/app/provider/list", "/admin/full-app/customer/provider/list");
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProviderProfile | null>(null);
  const [relationshipId, setRelationshipId] = useState<string | null>(null);

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

      const { data: provider, error: providerError } = await supabase
        .from("provider_public_profiles")
        .select("*")
        .eq("id", providerId)
        .single();

      const { data: metrics, error: metricsError } = await supabase
        .from("provider_metrics")
        .select("avg_rating, review_count, completed_jobs, years_active")
        .eq("id", providerId)
        .single();

      let durableRelationshipId: string | null = null;
      try {
        durableRelationshipId = (await getMyServiceRelationshipWithProvider(providerId))?.id ?? null;
      } catch {
        durableRelationshipId = null;
      }

      if (!active) return;
      setRelationshipId(durableRelationshipId);

      if (providerError || !provider) {
        setProfile(null);
      } else if (metricsError) {
        const data = {
          ...(provider as Record<string, unknown>),
          metrics: null,
        };
        setProfile(data as PublicProviderProfile);
      } else {
        const data = {
          ...(provider as Record<string, unknown>),
          metrics: metrics as Record<string, unknown>,
        };
        setProfile(data as PublicProviderProfile);
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
  const yearsActive = profile?.metrics?.years_active ?? null;
  const trustBadges = [
    rating !== null && rating >= 4.8 ? "Top Rated" : null,
    profile?.background_checked ? "Background Checked" : null,
    profile?.insured ? "Insured" : null,
    profile?.platform_verified ? "Platform Verified" : null,
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
        <Button
          onClick={goBack}
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-3 h-3" />}
          className="mb-3 !px-0 text-[#667085]"
        >
          Back
        </Button>
        <p className="text-sm">Provider profile not found.</p>
      </div>
    );
  }

  return (
    <div className="pb-28 text-[#0B1220]">
      <Button
        onClick={goBack}
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="w-3 h-3" />}
        className="mb-3 !px-0 text-[#667085]"
      >
        Back
      </Button>

      <section className="mb-3 overflow-hidden rounded-xl border border-[#E5E7EB]">
        <div
          className="relative min-h-[180px] bg-gradient-to-br from-[#0B1220] to-[#334155] px-4 py-4"
          aria-hidden={false}
        >
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,#8DCC64_0%,transparent_40%)]" />
          <div className="relative z-10 flex items-end gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-white/10 text-lg font-semibold text-white">
              {providerDisplayName(profile).charAt(0)}
            </div>
            <div className="pb-1">
              <h1 className="text-[24px] font-semibold leading-tight text-white">{providerDisplayName(profile)}</h1>
              {reviewCount > 0 && rating !== null ? (
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-white/90">
                  <Star className="h-4 w-4 text-[#8DCC64]" />
                  {rating.toFixed(1)} · {reviewCount} reviews
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-3 flex flex-wrap gap-2">
        {trustBadges.map((badge) => (
          <span
            key={badge}
            className="inline-flex items-center gap-1 rounded-full border border-[#CFE8C2] bg-[#F3FAF1] px-3 py-1 text-[12px] font-medium text-[#166534]"
          >
            <ShieldCheck className="h-3 w-3 text-[#8DCC64]" />
            {badge}
          </span>
        ))}
      </section>

      <section className="mb-3 grid grid-cols-3 gap-2">
        {reviewCount > 0 && rating !== null ? (
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-center shadow-sm">
            <p className="text-lg font-semibold text-[#0B1220]">{rating.toFixed(1)}</p>
            <p className="text-xs text-[#667085]">Rating</p>
          </div>
        ) : null}
        {completedJobs !== null ? (
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-center shadow-sm">
            <p className="text-lg font-semibold text-[#0B1220]">{completedJobs}+</p>
            <p className="text-xs text-[#667085]">Jobs</p>
          </div>
        ) : null}
        {yearsActive !== null ? (
          <div className="rounded-lg border border-[#E5E7EB] bg-white p-3 text-center shadow-sm">
            <p className="text-lg font-semibold text-[#0B1220]">{yearsActive}y</p>
            <p className="text-xs text-[#667085]">Experience</p>
          </div>
        ) : null}
      </section>

      <section className="provider-card mb-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#166534]">
          Why customers pick them
        </p>
        <p className="text-sm text-[#667085]">
          Professional cleaning service focused on reliability, detail, and care.
        </p>
      </section>

      <section className="provider-card">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#166534]">Service info</p>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-[#667085]">Service radius:</span>{" "}
            <span className="font-medium">{profile?.service_radius_miles ?? "—"} miles</span>
          </p>
          <p>
            <span className="text-[#667085]">Open-market availability:</span>{" "}
            <span className="font-medium">
              {profile?.marketplace_access ? "Active" : "Not active yet"}
            </span>
          </p>
          {relationshipId ? (
            <p>
              <span className="text-[#667085]">Your relationship:</span>{" "}
              <span className="font-medium">Established</span>
            </p>
          ) : null}
          <p>
            <span className="text-[#667085]">Member since:</span>{" "}
            <span className="font-medium">{memberSinceYear}</span>
          </p>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-24 z-10 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[720px]">
          {bookingId ? (
            <Button
              variant="primaryBlue"
              size="lg"
              fullWidth
              onClick={() => navigate(`/app/bookings/${bookingId}`)}
            >
              View Booking
            </Button>
          ) : relationshipId ? (
            <Button
              variant="primaryGreen"
              size="lg"
              fullWidth
              onClick={() => navigate(`/book?relationship=${encodeURIComponent(relationshipId)}`)}
            >
              Book another cleaning together
            </Button>
          ) : (
            <Button variant="secondary" size="lg" fullWidth disabled>
              Book This Provider
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
