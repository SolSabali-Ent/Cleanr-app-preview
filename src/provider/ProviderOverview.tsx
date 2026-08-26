// src/provider/ProviderOverview.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProviderContext } from "./ProviderContext";
import { mockBookings } from "../shell/mockCustomerData";
import { CalendarDays, MapPin, MessageCircleMore } from "lucide-react";
import { Button } from "../components/ui/Button";
import { providerDisplayName } from "./types";
import { listBookingsForCustomer } from "../lib/bookingApi";

export function ProviderOverview() {
  const navigate = useNavigate();
  const { selectedProvider } = useProviderContext();
  const [messageLoading, setMessageLoading] = useState(false);

  const upcoming = mockBookings.find((b) => b.status === "upcoming");

  const handleMessageProvider = async () => {
    if (!selectedProvider?.id) return;
    setMessageLoading(true);
    try {
      const bookings = await listBookingsForCustomer();
      const withThisProvider = bookings.find(
        (b) => b.provider_id && b.provider_id === selectedProvider.id
      );
      if (withThisProvider) {
        navigate(`/app/bookings/${withThisProvider.id}/message`);
      } else {
        navigate("/app/bookings");
      }
    } catch {
      navigate("/app/bookings");
    } finally {
      setMessageLoading(false);
    }
  };

  if (!selectedProvider) {
    return (
      <div className="text-[#0B1220]">
        <h1 className="text-xl font-semibold mb-2">Your provider</h1>
        <p className="text-sm text-[#667085] mb-3">
          Once you book a cleaning, your assigned Cleanr Service Provider will appear here.
        </p>
        <Button
          onClick={() => navigate("/app/provider/list")}
          variant="primaryGreen"
          size="lg"
          fullWidth
          className="mt-2"
        >
          Browse providers in my area
        </Button>
      </div>
    );
  }

  return (
    <div className="text-[#0B1220] pb-4">
      <h1 className="text-xl font-semibold mb-3 section">Your provider</h1>

      {/* Main provider card */}
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
              onClick={() =>
                navigate(`/app/provider/${selectedProvider.id}`)
              }
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

      {/* Next cleaning preview if exists */}
      {upcoming && (
        <section className="mb-3">
          <p className="text-xs font-semibold text-[#166534] mb-1">
            Next cleaning
          </p>
          <div className="next-cleaning-card flex justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{upcoming.serviceType}</p>
              <p className="text-xs text-[#667085] flex items-center gap-1 mt-1">
                <CalendarDays className="w-3 h-3" />
                {upcoming.date} · {upcoming.timeWindow}
              </p>
              <p className="text-xs text-[#667085] flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {upcoming.addressLine1}, {upcoming.city}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#667085]">Total</p>
              <p className="text-sm font-semibold">${upcoming.price}</p>
            </div>
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="mt-3 button-stack section">
        <Button onClick={() => navigate("/app/provider/list")} variant="secondary" size="lg" fullWidth>
          Change provider
        </Button>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          leftIcon={<MessageCircleMore className="w-3 h-3 text-[#8DCC64]" />}
          onClick={handleMessageProvider}
          disabled={messageLoading}
        >
          {messageLoading ? "Loading…" : "Message provider"}
        </Button>
      </section>
    </div>
  );
}

