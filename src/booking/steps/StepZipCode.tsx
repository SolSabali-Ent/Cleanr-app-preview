import { useState } from "react";
import type { FormEvent } from "react";
import { useBooking } from "../bookingStore";
import { Button } from "../../components/ui/Button";
import { ProviderPresenceStrip } from "../../components/provider/ProviderPresenceStrip";
import {
  getCustomerActivationStatus,
  type CustomerActivationReason,
  type CustomerActivationStatus,
} from "@/lib/customerActivation";
import { createWaitlistLead } from "@/lib/waitlistLeads";
import { recordBookingProgressEvent } from "@/lib/bookingProgress";

interface StepZipCodeProps {
  onNext: () => void;
}

export function StepZipCode({ onNext }: StepZipCodeProps) {
  const { state, update } = useBooking();
  const [zip, setZip] = useState(state.zipcode || "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activationHint, setActivationHint] = useState<string | null>(null);
  const [activationStatus, setActivationStatus] = useState<CustomerActivationStatus | null>(null);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  const isValidZip = (value: string) => /^\d{5}$/.test(value.trim());
  const isValidEmail = (value: string) => /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value.trim());

  const leadCaptureReasonFromActivation = (
    reason: CustomerActivationReason
  ): "unsupported_zip" | "provider_supply_building" | "market_not_active" | null => {
    if (reason === "unsupported_zip") return "unsupported_zip";
    if (reason === "provider_supply_building") return "provider_supply_building";
    if (reason === "disabled_by_config") return "market_not_active";
    return null;
  };

  const shouldShowLeadCapture = Boolean(
    activationStatus &&
      (!activationStatus.bookingEnabled || !activationStatus.serviceable) &&
      leadCaptureReasonFromActivation(activationStatus.reason)
  );

  const leadHeadline = activationStatus?.reason === "provider_supply_building"
    ? "Cleanr serves this area, and we're building local provider capacity."
    : activationStatus?.reason === "disabled_by_config"
      ? "Cleanr serves this area, but booking is not open here yet."
      : "Cleanr is not serving this ZIP yet.";

  const handleZipSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const zipTrimmed = zip.trim();

    if (!zipTrimmed || zipTrimmed.length !== 5) {
      setError("Please enter a valid 5-digit ZIP code.");
      return;
    }

    setLoading(true);
    setError(null);
    setActivationHint(null);
    setActivationStatus(null);
    setLeadError(null);
    setLeadSuccess(false);

    const status = await getCustomerActivationStatus(zipTrimmed);
    setActivationStatus(status);
    setLoading(false);

    if (status.reason === "unknown") {
      setError("Unable to confirm booking availability for this ZIP right now. Please try again.");
      return;
    }

    if (!status.serviceable || status.reason === "unsupported_zip") {
      void recordBookingProgressEvent({
        eventType: "zip_blocked_waitlist_offered",
        currentStep: "zip",
        zip: zipTrimmed,
        activationReason: "unsupported_zip",
        metadata: { serviceable: false, booking_enabled: false },
      });
      setError("Cleanr is not serving this ZIP yet.");
      setActivationHint("Join the early access list and we'll notify you when Cleanr reaches your area.");
      return;
    }

    if (!status.bookingEnabled) {
      if (status.reason === "provider_supply_building") {
        void recordBookingProgressEvent({
          eventType: "zip_blocked_waitlist_offered",
          currentStep: "zip",
          zip: zipTrimmed,
          activationReason: "provider_supply_building",
          metadata: {
            serviceable: true,
            booking_enabled: false,
            active_provider_count: status.activeProviderCount,
          },
        });
        setActivationHint(
          "Cleanr serves this area, and we're adding trusted local provider capacity before opening booking."
        );
        return;
      }
      if (status.reason === "disabled_by_config") {
        void recordBookingProgressEvent({
          eventType: "zip_blocked_waitlist_offered",
          currentStep: "zip",
          zip: zipTrimmed,
          activationReason: "market_not_active",
          metadata: { serviceable: true, booking_enabled: false },
        });
        setActivationHint("Cleanr serves this area, but booking is not open here yet.");
        return;
      }
      setError("Unable to confirm booking activation for this ZIP. Please try again.");
      return;
    }

    setActivationHint("Cleanr is available in your area.");
    update({ zipcode: zipTrimmed });
    onNext();
  };

  const handleLeadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLeadError(null);
    const reason = activationStatus ? leadCaptureReasonFromActivation(activationStatus.reason) : null;
    if (!activationStatus || !reason) return;
    if (!isValidEmail(leadEmail)) {
      setLeadError("Please enter a valid email address.");
      return;
    }

    setLeadSubmitting(true);
    try {
      await createWaitlistLead({
        zip: activationStatus.zip,
        email: leadEmail,
        name: leadName || null,
        phone: leadPhone || null,
        source: "zip_activation_gate",
        activationReason: reason,
        serviceable: activationStatus.serviceable,
        activeProviderCount: activationStatus.activeProviderCount,
      });
      setLeadSuccess(true);
    } catch {
      setLeadError("Could not save your early access request right now.");
    } finally {
      setLeadSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleZipSubmit} className="space-y-4">
        <div className="border border-[#E5E7EB] rounded-[14px] p-4 bg-white">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-9 h-9 rounded-full bg-[#EEF2FF] flex items-center justify-center text-[#0000FE] text-lg">
              📍
            </div>
            <h2 className="text-[16px] font-bold text-[#0B1220]">
              Let&apos;s get started
            </h2>
            <p className="text-[13px] font-medium text-[#667085]">
              Enter your zip code to check availability.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <input
              type="tel"
              inputMode="numeric"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="Enter zip code (e.g. 30024)"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base
                placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
            />
            {error && <p className="text-[12px] font-medium text-red-500">{error}</p>}
            {activationHint ? (
              <p className="text-[12px] font-medium text-[#667085]">{activationHint}</p>
            ) : null}
          </div>
        </div>

        <ProviderPresenceStrip zip={isValidZip(zip) ? zip.trim() : null} compact />

        <Button
          type="submit"
          disabled={loading || !isValidZip(zip)}
          loading={loading}
          variant="primaryBlue"
          size="lg"
          fullWidth
        >
          {loading ? "Checking..." : "Check Availability →"}
        </Button>
      </form>

      {shouldShowLeadCapture ? (
        <section className="rounded-2xl border border-[#E5E7EB] bg-white p-4 space-y-2" aria-live="polite">
          <h3 className="text-[14px] font-semibold text-[#0B1220]">{leadHeadline}</h3>
          <p className="text-[12px] text-[#667085]">
            Join the early access list and we&apos;ll notify you when booking opens.
          </p>
          <p className="text-[12px] text-[#667085]">
            Your ZIP helps us decide where to activate next.
          </p>

          {leadSuccess ? (
            <p className="text-[12px] font-medium text-[#166534]">
              Thanks. We saved your early access request.
            </p>
          ) : (
            <form className="space-y-2" onSubmit={handleLeadSubmit}>
              <input
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="Email for early access updates"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
              />
              <input
                type="text"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="Name (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
              />
              <input
                type="tel"
                value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
              />
              {leadError ? <p className="text-[12px] font-medium text-red-500">{leadError}</p> : null}
              <Button
                type="submit"
                disabled={leadSubmitting || !isValidEmail(leadEmail)}
                loading={leadSubmitting}
                variant="secondary"
                size="md"
                fullWidth
              >
                {leadSubmitting ? "Saving..." : "Join Early Access"}
              </Button>
            </form>
          )}
        </section>
      ) : null}
    </div>
  );
}
