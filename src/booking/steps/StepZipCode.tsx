import { useState } from "react";
import type { FormEvent } from "react";
import { useBooking } from "../bookingStore";
import { Button } from "../../components/ui/Button";
import { ProviderPresenceStrip } from "../../components/provider/ProviderPresenceStrip";
import { listMarketplaceProvidersForZip, type MarketplaceProviderChoice } from "@/lib/providerPresence";
import { getCustomerActivationStatus, type CustomerActivationStatus } from "@/lib/customerActivation";
import { createWaitlistLead } from "@/lib/waitlistLeads";
import { recordBookingProgressEvent } from "@/lib/bookingProgress";

interface StepZipCodeProps { onNext: () => void; }

export function StepZipCode({ onNext }: StepZipCodeProps) {
  const { state, update } = useBooking();
  const [zip, setZip] = useState(state.zipcode || "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activationHint, setActivationHint] = useState<string | null>(state.zipcode ? "Cleanr is available here." : null);
  const [activationStatus, setActivationStatus] = useState<CustomerActivationStatus | null>(null);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  const isValidZip = (value: string) => /^\d{5}$/.test(value.trim());
  const isValidEmail = (value: string) => /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value.trim());
  const normalizedZip = zip.trim();
  const zipConfirmed = isValidZip(normalizedZip) && state.zipcode === normalizedZip && (activationStatus === null || activationStatus.bookingEnabled);
  const shouldShowLeadCapture = Boolean(activationStatus && !activationStatus.serviceable && activationStatus.reason === "unsupported_zip");

  const handleZipChange = (value: string) => {
    const next = value.replace(/\D/g, "").slice(0, 5);
    setZip(next);
    setError(null);
    setLeadError(null);
    setLeadSuccess(false);
    if (next !== state.zipcode) {
      setActivationStatus(null);
      setActivationHint(null);
      if (state.zipcode) {
        update({
          zipcode: null,
          serviceAddress: { ...state.serviceAddress, zip: "", formatted: "", lat: null, lng: null, verified: false },
        });
      }
    }
  };

  const handleProviderSelection = (provider: MarketplaceProviderChoice | null) => {
    update({
      requestedProviderId: provider?.id ?? null,
      requestedProviderName: provider ? (provider.preferred_name?.trim() || provider.full_name?.trim() || "Selected CSP") : null,
    });
  };

  const handleZipSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const zipTrimmed = zip.trim();
    if (!isValidZip(zipTrimmed)) { setError("Enter a valid 5-digit ZIP code."); return; }
    if (zipConfirmed) { onNext(); return; }

    setLoading(true);
    setError(null);
    setActivationHint(null);
    setActivationStatus(null);
    setLeadError(null);
    setLeadSuccess(false);

    const status = await getCustomerActivationStatus(zipTrimmed);
    setActivationStatus(status);
    if (status.reason === "unknown") {
      setLoading(false);
      setError("We couldn't confirm availability right now. Try again.");
      return;
    }

    if (!status.serviceable || status.reason === "unsupported_zip") {
      setLoading(false);
      void recordBookingProgressEvent({ eventType: "zip_blocked_waitlist_offered", currentStep: "zip", zip: zipTrimmed, activationReason: "unsupported_zip", metadata: { serviceable: false, booking_enabled: false } });
      setError("Cleanr is not serving this ZIP yet.");
      setActivationHint("Join early access and we'll let you know when Cleanr reaches your area.");
      return;
    }

    if (!status.bookingEnabled) {
      setLoading(false);
      if (status.reason === "provider_supply_building") {
        void recordBookingProgressEvent({ eventType: "zip_blocked_provider_supply_building", currentStep: "zip", zip: zipTrimmed, activationReason: "provider_supply_building", metadata: { serviceable: true, booking_enabled: false, active_provider_count: status.activeProviderCount } });
        setActivationHint("We're adding local CSP capacity before opening booking here.");
        return;
      }
      if (status.reason === "disabled_by_config") {
        void recordBookingProgressEvent({ eventType: "zip_blocked_market_not_active", currentStep: "zip", zip: zipTrimmed, activationReason: "market_not_active", metadata: { serviceable: true, booking_enabled: false } });
        setActivationHint("Cleanr serves this area, but booking isn't open here yet.");
        return;
      }
      setError("We couldn't confirm booking availability. Try again.");
      return;
    }

    let requestedProviderId = state.requestedProviderId;
    let requestedProviderName = state.requestedProviderName;
    let providerHint: string | null = null;
    if (requestedProviderId && state.zipcode !== zipTrimmed) {
      try {
        const providers = await listMarketplaceProvidersForZip(zipTrimmed, 50);
        const selected = providers.find((provider) => provider.id === requestedProviderId) ?? null;
        if (selected) {
          requestedProviderName = selected.preferred_name?.trim() || selected.full_name?.trim() || requestedProviderName;
          providerHint = `${requestedProviderName || "Your selected CSP"} serves this ZIP. Exact address and time are checked before payment.`;
        } else {
          requestedProviderId = null;
          requestedProviderName = null;
          providerHint = "Your previous CSP choice doesn't cover this ZIP. Choose another below or let Cleanr match you.";
        }
      } catch {
        providerHint = "Your CSP choice is saved. Exact eligibility is checked before payment.";
      }
    }

    update({ zipcode: zipTrimmed, requestedProviderId, requestedProviderName });
    setLoading(false);
    setActivationHint(providerHint ?? "Cleanr is available here. Choose a CSP below or let Cleanr match you.");
  };

  const handleLeadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLeadError(null);
    if (!activationStatus || activationStatus.serviceable || activationStatus.reason !== "unsupported_zip") return;
    if (!isValidEmail(leadEmail)) { setLeadError("Enter a valid email address."); return; }
    setLeadSubmitting(true);
    try {
      await createWaitlistLead({ zip: activationStatus.zip, email: leadEmail, name: leadName || null, phone: leadPhone || null, source: "zip_activation_gate", activationReason: "unsupported_zip", serviceable: false, activeProviderCount: 0 });
      setLeadSuccess(true);
    } catch {
      setLeadError("We couldn't save your request right now.");
    } finally {
      setLeadSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleZipSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">ZIP code</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={5}
            value={zip}
            onChange={(e) => handleZipChange(e.target.value)}
            placeholder="e.g. 30024"
            autoFocus
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
          />
          {error ? <p className="mt-2 text-[12px] font-medium text-red-500">{error}</p> : null}
          {activationHint ? <p className="mt-2 text-[12px] leading-5 text-[#667085]">{activationHint}</p> : null}
        </div>

        {zipConfirmed ? (
          <ProviderPresenceStrip
            zip={normalizedZip}
            compact
            interactive
            confirmed
            selectedProviderId={state.requestedProviderId}
            onSelectProvider={handleProviderSelection}
          />
        ) : null}

        <Button type="submit" disabled={loading || !isValidZip(zip)} loading={loading} variant="primaryBlue" size="lg" fullWidth>
          {loading ? "Checking…" : zipConfirmed ? "Continue" : "Check availability"}
        </Button>
      </form>

      {shouldShowLeadCapture ? (
        <section className="border-t border-[#E4E7EC] pt-4" aria-live="polite">
          <h3 className="text-[14px] font-semibold text-[#0B1220]">Join early access</h3>
          <p className="mt-1 text-[12px] leading-5 text-[#667085]">We'll notify you when booking opens in {activationStatus?.zip}.</p>
          {leadSuccess ? (
            <p className="mt-3 text-[12px] font-medium text-[#166534]">You're on the list.</p>
          ) : (
            <form className="mt-3 space-y-2" onSubmit={handleLeadSubmit}>
              <input type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]" />
              <details>
                <summary className="cursor-pointer list-none text-[11px] font-semibold text-[#667085]">Add name or phone</summary>
                <div className="mt-2 space-y-2">
                  <input type="text" value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Name (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900" />
                  <input type="tel" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="Phone (optional)" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900" />
                </div>
              </details>
              {leadError ? <p className="text-[12px] font-medium text-red-500">{leadError}</p> : null}
              <Button type="submit" disabled={leadSubmitting || !isValidEmail(leadEmail)} loading={leadSubmitting} variant="secondary" size="md" fullWidth>Join early access</Button>
            </form>
          )}
        </section>
      ) : null}
    </div>
  );
}
