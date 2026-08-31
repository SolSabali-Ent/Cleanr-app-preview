// src/provider/ProviderOverview.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProviderContext } from "./ProviderContext";
import { CalendarDays, Heart, MessageCircleMore } from "lucide-react";
import { Button } from "../components/ui/Button";
import { providerDisplayName } from "./types";
import { listBookingsForCustomer } from "../lib/bookingApi";
import type { Booking } from "../domain/booking";
import type { ServiceRelationship } from "../domain/serviceRelationship";
import { customerFacingServiceLabel } from "../lib/serviceCatalog";
import { getMyServiceRelationshipWithProvider, setMyPreferredServiceProvider } from "../lib/serviceRelationshipApi";
import { isOfflinePreviewMode } from "../lib/supabase";

function formatDateTime(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export function ProviderOverview() {
  const navigate = useNavigate();
  const { selectedProvider, relationshipSource } = useProviderContext();
  const [messageLoading, setMessageLoading] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [durableRelationship, setDurableRelationship] = useState<ServiceRelationship | null>(null);
  const [preferenceBusy, setPreferenceBusy] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadBookings() {
      try {
        const data = await listBookingsForCustomer();
        if (active) setBookings(data);
      } catch {
        if (active) setBookings([]);
      }
    }
    void loadBookings();
    return () => {
      active = false;
    };
  }, []);

  const relationshipBookings = useMemo(() => {
    if (!selectedProvider?.id) return [];
    return bookings
      .filter((booking) => booking.provider_id === selectedProvider.id)
      .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime());
  }, [bookings, selectedProvider?.id]);

  const nextCleaning = useMemo(() => {
    const now = Date.now();
    return relationshipBookings.find((booking) => {
      const when = new Date(booking.scheduled_start).getTime();
      return Number.isFinite(when) && when >= now && booking.status !== "cancelled";
    }) ?? null;
  }, [relationshipBookings]);

  const bookingHistoryCompletedTogether = relationshipBookings.filter((booking) =>
    ["completed_by_provider", "confirmed"].includes(booking.status)
  ).length;
  const completedTogether = durableRelationship?.completedServicesCount ?? bookingHistoryCompletedTogether;
  const hasEstablishedHistory = Boolean(durableRelationship) || relationshipBookings.length > 0;

  useEffect(() => {
    if (!selectedProvider?.id || isOfflinePreviewMode) {
      setDurableRelationship(null);
      return;
    }

    let active = true;
    void getMyServiceRelationshipWithProvider(selectedProvider.id)
      .then((relationship) => {
        if (active) setDurableRelationship(relationship);
      })
      .catch(() => {
        if (active) setDurableRelationship(null);
      });

    return () => { active = false; };
  }, [selectedProvider?.id]);

  const handleMessageProvider = async () => {
    if (!selectedProvider?.id) return;
    setMessageLoading(true);
    try {
      const withThisProvider = [...relationshipBookings]
        .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())[0];
      if (withThisProvider) {
        navigate(`/app/bookings/${withThisProvider.id}/message`);
      } else {
        navigate("/app/bookings");
      }
    } finally {
      setMessageLoading(false);
    }
  };

  const handlePreferredProvider = async () => {
    if (!selectedProvider?.id || !durableRelationship || preferenceBusy) return;
    setPreferenceBusy(true);
    setPreferenceError(null);
    try {
      const updated = await setMyPreferredServiceProvider(
        selectedProvider.id,
        !durableRelationship.customerPreferred
      );
      setDurableRelationship(updated);
    } catch {
      setPreferenceError("We couldn't update your CSP preference right now.");
    } finally {
      setPreferenceBusy(false);
    }
  };

  if (!selectedProvider) {
    return (
      <div className="text-[#0B1220]">
        <h1 className="text-xl font-semibold mb-2">Your Cleanr connection</h1>
        <p className="text-sm text-[#667085] mb-3">
          No provider relationship is established yet. Browse CSPs or book a cleaning to get started.
        </p>
        <Button
          onClick={() => navigate("/app/provider/list")}
          variant="primaryGreen"
          size="lg"
          fullWidth
          className="mt-2"
        >
          Browse providers
        </Button>
      </div>
    );
  }

  const relationshipLabel = durableRelationship?.customerPreferred
    ? "Your preferred CSP"
    : relationshipSource === "durable_relationship"
      ? "Your established CSP"
      : relationshipSource === "customer_selection"
        ? "CSP you're viewing"
        : relationshipSource === "booking_history"
          ? "Your recent CSP"
          : "CSP you're viewing";

  return (
    <div className="text-[#0B1220] pb-4">
      <div className="mb-3 section">
        <p className="text-xs uppercase tracking-[0.18em] text-[#166534] font-medium">{relationshipLabel}</p>
        <h1 className="text-xl font-semibold mt-1">Your Cleanr connection</h1>
      </div>

      <div className="provider-card flex gap-3 mb-3">
        <div className="w-14 h-14 rounded-full bg-[#F1F5F9] border border-[#E5E7EB] text-[#0B1220] flex-shrink-0 flex items-center justify-center text-base font-semibold">
          {providerDisplayName(selectedProvider).charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{providerDisplayName(selectedProvider)}</p>
              {typeof selectedProvider.avg_rating === "number" && (selectedProvider.review_count ?? 0) > 0 ? (
                <p className="text-xs text-[#667085] mt-0.5">
                  ⭐ {selectedProvider.avg_rating.toFixed(1)} · {selectedProvider.review_count} reviews
                </p>
              ) : null}
            </div>
            <Button
              onClick={() => navigate(`/app/provider/${selectedProvider.id}`)}
              variant="ghost"
              size="sm"
              className="text-[11px] text-[#8DCC64] underline underline-offset-2 !px-0"
            >
              View details
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedProvider.background_checked ? <span className="provider-badge">Background Checked</span> : null}
            {selectedProvider.insured ? <span className="provider-badge">Insured</span> : null}
            {selectedProvider.platform_verified ? <span className="provider-badge">Platform Verified</span> : null}
          </div>
        </div>
      </div>

      <section className="provider-card mb-3">
        <p className="text-xs font-semibold text-[#166534] mb-2">Your history together</p>
        {hasEstablishedHistory ? (
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {completedTogether > 0
                ? `${completedTogether} ${completedTogether === 1 ? "cleaning" : "cleanings"} completed together`
                : "Your relationship is established"}
            </p>
            <p className="text-xs text-[#667085]">
              {completedTogether > 0
                ? durableRelationship
                  ? "Cleanr preserves this relationship as durable continuity, so the connection does not restart from zero with every booking."
                  : "Cleanr keeps your shared booking history connected while durable relationship continuity catches up."
                : "Cleanr keeps this connection available without treating either of you as locked in."}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[#667085]">
            You're viewing this CSP. Shared service history will appear here only after you actually book and work together.
          </p>
        )}
      </section>

      {durableRelationship ? (
        <section className="provider-card mb-3">
          <div className="flex items-start gap-3">
            <Heart className="w-4 h-4 mt-0.5 text-[#8DCC64]" fill={durableRelationship.customerPreferred ? "#8DCC64" : "none"} />
            <div className="flex-1">
              <p className="text-sm font-semibold">{durableRelationship.customerPreferred ? "Preferred CSP" : "Make this my preferred CSP"}</p>
              <p className="text-xs text-[#667085] mt-1">
                Preference helps Cleanr preserve continuity when possible. It does not lock you in—you can choose someone else or change this anytime.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            fullWidth
            className="mt-3"
            loading={preferenceBusy}
            disabled={preferenceBusy}
            onClick={() => void handlePreferredProvider()}
          >
            {durableRelationship.customerPreferred ? "Remove preference" : "Prefer this CSP"}
          </Button>
          {preferenceError ? <p className="text-xs text-red-600 mt-2">{preferenceError}</p> : null}
        </section>
      ) : null}

      {nextCleaning ? (
        <section className="mb-3">
          <p className="text-xs font-semibold text-[#166534] mb-1">Next cleaning together</p>
          <button
            type="button"
            onClick={() => navigate(`/app/bookings/${nextCleaning.id}`)}
            className="next-cleaning-card w-full text-left"
          >
            <p className="text-sm font-semibold">{customerFacingServiceLabel(nextCleaning.service_type)}</p>
            <p className="text-xs text-[#667085] flex items-center gap-1 mt-1">
              <CalendarDays className="w-3 h-3" />
              {formatDateTime(nextCleaning.scheduled_start)}
            </p>
          </button>
        </section>
      ) : null}

      <section className="mt-3 button-stack section">
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          leftIcon={<MessageCircleMore className="w-3 h-3 text-[#8DCC64]" />}
          onClick={handleMessageProvider}
          disabled={messageLoading || relationshipBookings.length === 0}
        >
          {messageLoading ? "Loading…" : "Message CSP"}
        </Button>
        <Button onClick={() => navigate("/app/provider/list")} variant="secondary" size="lg" fullWidth>
          Browse providers
        </Button>
      </section>
    </div>
  );
}
