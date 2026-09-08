import { useEffect, useState } from "react";
import { Gift, UserRoundCheck, Wallet, Zap } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBooking } from "../bookingStore";
import { createBookingCheckoutSession } from "../../lib/bookingApi";
import { createVerifiedBooking } from "../../lib/verifiedBookingApi";
import { setMyBookingServiceRelationshipContext } from "../../lib/bookingRelationshipApi";
import { setMyBookingRequestedProvider } from "../../lib/bookingRequestedProviderApi";
import { recordBookingProgressEvent, serviceOptionKeyFromBookingService } from "../../lib/bookingProgress";
import { emitBookingAbandoned } from "../../lib/kinex/events";
import { customerFacingServiceLabel } from "../../lib/serviceCatalog";
import { getMyCustomerValueSummary } from "../../lib/customerAffiliateApi";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";

interface StepReviewProps { onBack: () => void; }

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

async function checkoutErrorMessage(err: unknown): Promise<string> {
  const fallback = err instanceof Error ? err.message : "We couldn't start payment. Please try again.";
  const context = (err as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const payload = (await context.clone().json()) as { error?: unknown; message?: unknown } | null;
      const message = payload?.error ?? payload?.message;
      if (typeof message === "string" && message.trim()) return message.trim();
    } catch {
      try { const text = await context.clone().text(); if (text.trim()) return text.trim(); } catch { /* fall through */ }
    }
  }
  return fallback;
}

function relationshipCheckoutBlocked(message: string): boolean {
  return message.includes("RELATIONSHIP_NOT_ACTIVE_FOR_NEW_BOOKING")
    || message.includes("active_service_relationship_required_for_booking_context")
    || message.includes("invalid_service_relationship_context");
}

function requestedProviderBlocked(message: string): boolean {
  return message.includes("requested_provider_not_available_for_booking")
    || message.includes("requested_provider_outside_service_radius")
    || message.includes("requested_provider_rejects_booking")
    || message.includes("requested_provider_not_marketplace_available");
}

export function StepReview({ onBack }: StepReviewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useBooking();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [priorityRate, setPriorityRate] = useState(0.25);
  const [valueSummary, setValueSummary] = useState({ cleanrCreditBalanceCents: 0, acquisitionCreditCents: 0 });
  const serviceRelationshipId = searchParams.get("relationship")?.trim() || null;
  const requestedProviderName = state.requestedProviderName?.trim() || "your selected CSP";

  useEffect(() => {
    let active = true;
    void supabase.rpc("get_public_booking_upsell_config").then(({ data }) => {
      if (!active || !data || typeof data !== "object") return;
      const rate = Number((data as Record<string, unknown>).urgent_surcharge_rate);
      if (Number.isFinite(rate) && rate >= 0) setPriorityRate(rate);
    });
    void getMyCustomerValueSummary().then((summary) => {
      if (active) setValueSummary(summary);
    }).catch(() => {
      // Checkout remains usable if the optional customer-value summary cannot load.
    });
    return () => { active = false; };
  }, []);

  const handleConfirm = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        void recordBookingProgressEvent({
          eventType: "auth_required_checkout_blocked",
          currentStep: "review",
          zip: state.zipcode ?? null,
          serviceOptionKey: serviceOptionKeyFromBookingService(state.serviceType),
        });
        navigate("/signin?continue=booking");
        return;
      }

      const bookingId = await createVerifiedBooking(state);
      if (serviceRelationshipId) {
        await setMyBookingServiceRelationshipContext(bookingId, serviceRelationshipId);
      } else if (state.requestedProviderId) {
        await setMyBookingRequestedProvider(bookingId, state.requestedProviderId);
      }

      const priorityMetadata = state.priorityRequested ? { service_priority: "urgent" } : {};
      const providerMetadata = state.requestedProviderId && !serviceRelationshipId
        ? { requested_provider_id: state.requestedProviderId, provider_selection: "customer_selection" }
        : {};
      void recordBookingProgressEvent({
        eventType: "booking_created_payment_not_started",
        currentStep: "review",
        bookingId,
        zip: state.zipcode ?? null,
        serviceOptionKey: serviceOptionKeyFromBookingService(state.serviceType),
        metadata: { ...priorityMetadata, ...providerMetadata, ...(serviceRelationshipId ? { relationship_context: "customer_selected_existing_relationship" } : {}) },
      });
      void recordBookingProgressEvent({
        eventType: "checkout_started_payment_not_completed",
        currentStep: "review",
        bookingId,
        zip: state.zipcode ?? null,
        serviceOptionKey: serviceOptionKeyFromBookingService(state.serviceType),
        metadata: { transport: "stripe_checkout_redirect", location_precision: "verified_street_address", ...priorityMetadata, ...providerMetadata, ...(serviceRelationshipId ? { relationship_context: "customer_selected_existing_relationship" } : {}) },
      });

      const { url } = await createBookingCheckoutSession(bookingId);
      window.location.assign(url);
    } catch (err) {
      const message = await checkoutErrorMessage(err);
      const relationshipBlocked = relationshipCheckoutBlocked(message);
      const providerBlocked = requestedProviderBlocked(message);
      if (message.includes("PROVIDER_SUPPLY_BUILDING") || message.includes("MARKET_NOT_ACTIVE") || message.includes("UNSUPPORTED_SERVICE_AREA") || relationshipBlocked || providerBlocked) {
        const activationReason = relationshipBlocked
          ? "relationship_not_active"
          : providerBlocked
            ? "requested_provider_unavailable"
            : message.includes("PROVIDER_SUPPLY_BUILDING")
              ? "provider_supply_building"
              : message.includes("UNSUPPORTED_SERVICE_AREA")
                ? "unsupported_service_area"
                : "market_not_active";
        void recordBookingProgressEvent({ eventType: "booking_created_payment_not_started", currentStep: "review", zip: state.zipcode ?? null, serviceOptionKey: serviceOptionKeyFromBookingService(state.serviceType), metadata: { checkout_block_reason: activationReason } });
        void supabase.auth.getUser().then(({ data: { user } }) => { if (user?.id) emitBookingAbandoned(user.id, "review_checkout_blocked", 0); });
      }
      if (relationshipBlocked) {
        setSubmitError("This relationship is paused or no longer active, so it can't start a new cleaning together. Manage the relationship or choose another CSP.");
      } else if (message.includes("requested_provider_not_available_for_booking")) {
        setSubmitError(`${requestedProviderName} isn't available for this arrival window. Go back to choose another time or CSP, or choose “Let Cleanr match me.”`);
      } else if (message.includes("requested_provider_outside_service_radius")) {
        setSubmitError(`${requestedProviderName} doesn't serve this exact address. Go back to choose another CSP or let Cleanr match you.`);
      } else if (message.includes("requested_provider_rejects_booking")) {
        setSubmitError(`${requestedProviderName} isn't accepting this service or frequency right now. Choose another CSP or let Cleanr match you.`);
      } else if (message.includes("requested_provider_not_marketplace_available")) {
        setSubmitError(`${requestedProviderName} is no longer accepting new Cleanr marketplace bookings. Choose another CSP or let Cleanr match you.`);
      } else if (message.includes("PROVIDER_SUPPLY_BUILDING")) {
        setSubmitError(state.requestedProviderId
          ? `${requestedProviderName} isn't available for this time. Choose another arrival window or CSP.`
          : "No Cleanr provider is available for this time. Choose another arrival window.");
      } else if (message.includes("MARKET_NOT_ACTIVE")) setSubmitError("Booking is not open in this area yet. Check back soon.");
      else if (message.includes("UNSUPPORTED_SERVICE_AREA")) setSubmitError("Cleanr is not serving this ZIP yet.");
      else setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {valueSummary.acquisitionCreditCents > 0 ? (
        <div className="rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 text-[#166534]"><Gift className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-semibold text-[#166534]">Your {money(valueSummary.acquisitionCreditCents)} referral credit is ready</p>
              <p className="mt-1 text-xs leading-5 text-[#3F6212]">We'll apply it automatically at secure payment. No code needed.</p>
            </div>
          </div>
        </div>
      ) : null}

      {valueSummary.cleanrCreditBalanceCents > 0 ? (
        <div className="rounded-2xl border border-[#DDE7F5] bg-[#F7F9FC] p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 text-[#475467]"><Wallet className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-semibold">You have {money(valueSummary.cleanrCreditBalanceCents)} in Cleanr credit</p>
              <p className="mt-1 text-xs leading-5 text-[#667085]">We'll use what can safely apply to this cleaning. Any unused credit stays in your balance.</p>
            </div>
          </div>
        </div>
      ) : null}

      {state.priorityRequested ? (
        <div className="rounded-2xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-[#FEF3C7] p-2 text-[#92400E]"><Zap className="h-4 w-4" /></div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#78350F]">Priority cleaning</p>
                <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[11px] font-semibold text-[#92400E]">+{Math.round(priorityRate * 100)}%</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[#92400E]">This is a short-notice booking. The priority charge will be included in the final total before you pay.</p>
            </div>
          </div>
        </div>
      ) : null}

      {serviceRelationshipId ? (
        <div className="rounded-[14px] border border-[#BBF7D0] bg-[#F0FDF4] p-4">
          <p className="text-[13px] font-semibold text-[#166534]">Booking through your existing CSP relationship</p>
          <p className="mt-1 text-[12px] leading-5 text-[#3F6212]">We'll confirm the relationship is active and that this CSP is available before payment begins.</p>
        </div>
      ) : state.requestedProviderId ? (
        <div className="rounded-[14px] border border-[#BBF7D0] bg-[#F0FDF4] p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white p-2 text-[#166534]"><UserRoundCheck className="h-4 w-4" /></div>
            <div>
              <p className="text-[13px] font-semibold text-[#166534]">Requested CSP: {requestedProviderName}</p>
              <p className="mt-1 text-[12px] leading-5 text-[#3F6212]">Before payment starts, Cleanr will confirm this exact CSP serves your verified address and is available for the date and arrival window you chose.</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-4 space-y-3 text-sm">
        <div>
          <p className="text-[12px] font-medium text-[#667085] uppercase">Service</p>
          <p className="mt-1 text-[14px] font-medium text-[#0B1220]">{state.serviceType ? customerFacingServiceLabel(state.serviceType) : "Not selected"}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[12px] font-medium text-[#667085] uppercase">Home</p>
            <p className="mt-1 text-[13px] font-medium text-[#0B1220]">{state.homeDetails.bedrooms ?? "-"} bd • {state.homeDetails.bathrooms ?? "-"} ba</p>
            {state.homeDetails.sqft ? <p className="text-[12px] font-medium text-[#667085]">Approx. {state.homeDetails.sqft} sq ft</p> : null}
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#667085] uppercase">Frequency</p>
            <p className="mt-1 text-[13px] font-medium text-[#0B1220]">{state.frequency ?? "One-time"}</p>
          </div>
        </div>

        <div>
          <p className="text-[12px] font-medium text-[#667085] uppercase">Extras</p>
          <p className="mt-1 text-[13px] font-medium text-[#0B1220]">{state.extras.length ? state.extras.join(", ") : "No add-ons"}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[12px] font-medium text-[#667085] uppercase">When</p>
            <p className="mt-1 text-[13px] font-medium text-[#0B1220]">{state.date ?? "Date not set"}</p>
            <p className="text-[12px] font-medium text-[#667085]">{state.time ?? "Time window not set"}</p>
          </div>
          <div>
            <p className="text-[12px] font-medium text-[#667085] uppercase">Where</p>
            <p className="mt-1 text-[13px] font-medium text-[#0B1220] leading-5">{state.serviceAddress.verified ? state.serviceAddress.formatted : "Address not verified"}</p>
          </div>
        </div>

        <div>
          <p className="text-[12px] font-medium text-[#667085] uppercase">CSP preference</p>
          <p className="mt-1 text-[13px] font-medium text-[#0B1220]">{state.requestedProviderId ? requestedProviderName : "Let Cleanr match me"}</p>
          <p className="text-[12px] font-medium text-[#667085]">{state.requestedProviderId ? "Exact eligibility is checked before payment." : "Cleanr will match an eligible CSP for this visit."}</p>
        </div>

        <div>
          <p className="text-[12px] font-medium text-[#667085] uppercase">Contact</p>
          <p className="mt-1 text-[13px] font-medium text-[#0B1220]">{state.contact.name || "Name not set"}</p>
          <p className="text-[12px] font-medium text-[#667085]">{state.contact.email || "Email not set"}</p>
          <p className="text-[12px] font-medium text-[#667085]">{state.contact.phone || "Phone not set"}</p>
        </div>
      </div>

      {submitError ? <p className="text-[12px] font-medium text-red-500">{submitError}</p> : null}

      <p className="text-[12px] text-center text-[#667085]">You'll see the final total, including any Cleanr credit, before you're charged. If you're not signed in yet, Cleanr will ask you to sign in or create an account only when you continue to secure payment.</p>
      <Button type="button" onClick={handleConfirm} disabled={isSubmitting || !state.serviceAddress.verified} loading={isSubmitting} variant="primaryBlue" size="lg" fullWidth>
        {isSubmitting ? "Starting payment…" : "Continue to Secure Payment →"}
      </Button>
      <Button type="button" onClick={onBack} variant="secondary" size="lg" fullWidth>Back to make changes</Button>
      <p className="text-[12px] font-medium text-center text-[#667085]">By confirming, you agree to Cleanr&apos;s terms of service and cancellation policy.</p>
    </div>
  );
}
