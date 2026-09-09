import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useProviderContext } from "./ProviderContext";
import { CalendarDays, Heart, MessageCircleMore, UserRoundSearch } from "lucide-react";
import { Button } from "../components/ui/Button";
import { AppList, AppListRow, AppPageHeader, AppPanel } from "../components/shared/AppUi";
import { providerDisplayName } from "./types";
import { listBookingsForCustomer } from "../lib/bookingApi";
import { getSignedProfilePhotoUrl } from "../lib/profilePhotoApi";
import type { Booking } from "../domain/booking";
import type { ServiceRelationship } from "../domain/serviceRelationship";
import { customerFacingServiceLabel } from "../lib/serviceCatalog";
import { isCurrentCustomerUpcoming } from "../lib/bookingServiceDay";
import { getMyServiceRelationshipWithProvider, setMyPreferredServiceProvider } from "../lib/serviceRelationshipApi";
import { isOfflinePreviewMode } from "../lib/supabase";
import { customerRouteForContext } from "../lib/contextualRoutes";

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

export function ProviderOverview() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { selectedProvider, relationshipSource } = useProviderContext();
  const [messageLoading, setMessageLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [durableRelationship, setDurableRelationship] = useState<ServiceRelationship | null>(null);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [providerPhotoUrl, setProviderPhotoUrl] = useState<string | null>(null);
  const route = (canonicalPath: string) => customerRouteForContext(pathname, canonicalPath);

  useEffect(() => {
    let active = true;
    listBookingsForCustomer()
      .then((data) => { if (active) setBookings(data); })
      .catch(() => { if (active) setBookings([]); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setProviderPhotoUrl(null);
    if (!selectedProvider?.profile_photo_path) return () => { active = false; };
    void getSignedProfilePhotoUrl(selectedProvider.profile_photo_path)
      .then((url) => { if (active) setProviderPhotoUrl(url); })
      .catch(() => { if (active) setProviderPhotoUrl(null); });
    return () => { active = false; };
  }, [selectedProvider?.id, selectedProvider?.profile_photo_path]);

  const relationshipBookings = useMemo(() => {
    if (!selectedProvider?.id) return [];
    return bookings
      .filter((booking) => booking.provider_id === selectedProvider.id)
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());
  }, [bookings, selectedProvider?.id]);

  const nextCleaning = useMemo(() => relationshipBookings.find((booking) => isCurrentCustomerUpcoming(booking)) ?? null, [relationshipBookings]);
  const bookingHistoryCompletedTogether = relationshipBookings.filter((booking) => ["completed_by_provider", "confirmed"].includes(booking.status)).length;
  const completedTogether = durableRelationship?.completedServicesCount ?? bookingHistoryCompletedTogether;
  const relationshipActive = durableRelationship?.status === "active";
  const relationshipPaused = durableRelationship?.status === "paused";

  useEffect(() => {
    if (!selectedProvider?.id || isOfflinePreviewMode) {
      setDurableRelationship(null);
      return;
    }
    let active = true;
    void getMyServiceRelationshipWithProvider(selectedProvider.id)
      .then((relationship) => { if (active) setDurableRelationship(relationship); })
      .catch(() => { if (active) setDurableRelationship(null); });
    return () => { active = false; };
  }, [selectedProvider?.id]);

  const handleMessageProvider = async () => {
    if (!selectedProvider?.id) return;
    setMessageLoading(true);
    try {
      const latest = [...relationshipBookings].sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())[0];
      navigate(latest ? route(`/app/bookings/${latest.id}/message`) : route("/app/bookings"));
    } finally {
      setMessageLoading(false);
    }
  };

  const handlePreferredProvider = async () => {
    if (!selectedProvider?.id || !durableRelationship || preferenceBusy) return;
    if (durableRelationship.status !== "active" && !durableRelationship.customerPreferred) return;
    setPreferenceBusy(true);
    setPreferenceError(null);
    try {
      setDurableRelationship(await setMyPreferredServiceProvider(selectedProvider.id, !durableRelationship.customerPreferred));
    } catch {
      setPreferenceError("We couldn't update your CSP preference right now.");
    } finally {
      setPreferenceBusy(false);
    }
  };

  if (!selectedProvider) {
    return (
      <div className="text-[#0B1220]">
        <AppPageHeader title="My CSP" description="When you build a service relationship, it will live here." />
        <Button onClick={() => navigate(route("/app/provider/list"))} variant="primaryGreen" size="lg" fullWidth>Browse CSPs</Button>
      </div>
    );
  }

  const displayName = providerDisplayName(selectedProvider);
  const relationshipLabel = relationshipPaused
    ? "Paused relationship"
    : durableRelationship?.customerPreferred
      ? "Preferred CSP"
      : relationshipSource === "durable_relationship"
        ? "Established CSP"
        : relationshipSource === "booking_history"
          ? "Recent CSP"
          : "CSP profile";

  return (
    <div className="pb-4 text-[#0B1220]">
      <AppPageHeader eyebrow={relationshipLabel} title={displayName} description={completedTogether > 0 ? `${completedTogether} completed cleaning${completedTogether === 1 ? "" : "s"} together.` : "Your service relationship and next visit."} />

      <AppPanel className="mb-5">
        <div className="flex gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#E5E7EB] bg-[#F1F5F9] text-lg font-semibold">
            {providerPhotoUrl ? <img src={providerPhotoUrl} alt={`${displayName} profile`} className="h-full w-full object-cover" onError={() => setProviderPhotoUrl(null)} /> : displayName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">{displayName}</p>
            {typeof selectedProvider.avg_rating === "number" && (selectedProvider.review_count ?? 0) > 0 ? (
              <p className="mt-1 text-xs text-[#667085]">★ {selectedProvider.avg_rating.toFixed(1)} · {selectedProvider.review_count} reviews</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedProvider.background_checked ? <span className="provider-badge">Background checked</span> : null}
              {selectedProvider.insured ? <span className="provider-badge">Provider insurance verified</span> : null}
              {selectedProvider.platform_verified ? <span className="provider-badge">Verified</span> : null}
            </div>
          </div>
        </div>
        <button type="button" onClick={() => navigate(route(`/app/provider/${selectedProvider.id}`))} className="mt-4 text-xs font-semibold text-[#166534]">View full profile</button>
      </AppPanel>

      {nextCleaning ? (
        <section className="mb-5">
          <p className="mb-2 text-sm font-medium text-[#667085]">Next visit together</p>
          <button type="button" onClick={() => navigate(route(`/app/bookings/${nextCleaning.id}`))} className="w-full text-left">
            <AppPanel>
              <p className="text-sm font-semibold">{customerFacingServiceLabel(nextCleaning.service_type)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-[#667085]"><CalendarDays className="h-3.5 w-3.5" />{formatDateTime(nextCleaning.scheduled_start)}</p>
            </AppPanel>
          </button>
        </section>
      ) : null}

      {durableRelationship ? (
        <section className="mb-5">
          <p className="mb-2 text-sm font-medium text-[#667085]">Relationship</p>
          <AppList>
            <AppListRow
              title={relationshipPaused ? "Relationship paused" : durableRelationship.customerPreferred ? "Preferred CSP" : "Preference"}
              description={relationshipPaused ? "Your history stays here. Resume when you want to continue together." : durableRelationship.customerPreferred ? "Cleanr will preserve continuity with this CSP when possible." : "Mark this CSP preferred if you want Cleanr to prioritize continuity."}
              leading={<Heart className="h-4 w-4 text-[#8DCC64]" fill={durableRelationship.customerPreferred ? "#8DCC64" : "none"} />}
              trailing={relationshipActive || durableRelationship.customerPreferred ? <button type="button" disabled={preferenceBusy} onClick={() => void handlePreferredProvider()} className="text-xs font-semibold text-[#166534] disabled:opacity-50">{durableRelationship.customerPreferred ? "Remove" : "Prefer"}</button> : undefined}
              onClick={relationshipPaused && !durableRelationship.customerPreferred ? () => navigate(route("/app/relationships")) : undefined}
            />
          </AppList>
          {preferenceError ? <p className="mt-2 text-xs text-red-600">{preferenceError}</p> : null}
        </section>
      ) : null}

      <section>
        <p className="mb-2 text-sm font-medium text-[#667085]">What next</p>
        <div className="space-y-2">
          {relationshipActive && durableRelationship ? (
            <Button variant="primaryGreen" size="lg" fullWidth onClick={() => navigate(`/book?relationship=${encodeURIComponent(durableRelationship.id)}`)}>Book together again</Button>
          ) : relationshipPaused ? (
            <Button variant="secondary" size="lg" fullWidth onClick={() => navigate(route("/app/relationships"))}>Manage paused relationship</Button>
          ) : null}
          <AppList>
            <AppListRow
              title="Message CSP"
              description={relationshipBookings.length > 0 ? "Continue the conversation from your service relationship." : "Messaging opens after you have a booking together."}
              leading={<MessageCircleMore className="h-4 w-4 text-[#166534]" />}
              onClick={relationshipBookings.length > 0 && !messageLoading ? () => void handleMessageProvider() : undefined}
            />
            <AppListRow divided title="Browse other CSPs" description="You can always choose someone else." leading={<UserRoundSearch className="h-4 w-4 text-[#667085]" />} onClick={() => navigate(route("/app/provider/list"))} />
          </AppList>
        </div>
      </section>
    </div>
  );
}
