import { useEffect, useState } from "react";
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
import {
  acceptCheckoutLegalDocuments,
  getCheckoutLegalDocuments,
  type CheckoutLegalDocument,
} from "../../lib/legalAcceptanceApi";
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
  const [legalDocuments, setLegalDocuments] = useState<CheckoutLegalDocument[]>([]);
  const [legalAccepted, setLegalAccepted] = useState(false);
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
    }).catch(() => undefined);
    void getCheckoutLegalDocuments().then((documents) => {
      if (active) {
        setLegalDocuments(documents);
        setLegalAccepted(false);
      }
    }).catch(() => {
      if (active) setLegalDocuments([]);
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

      if (legalDocuments.length > 0) {
        if (!legalAccepted) {
          setSubmitError("Review and accept the required terms before continuing to payment.");
          return;
        }
        await acceptCheckoutLegalDocuments(legalDocuments);
      }

      const bookingId = await createVerifiedBooking(state);
      if (serviceRelationshipId) await setMyBookingServiceRelationshipContext(bookingId, serviceRelationshipId);
      else if (state.requestedProviderId) await setMyBookingRequestedProvider(bookingId, state.requestedProviderId);

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
      if (message.includes("LEGAL_ACCEPTANCE_REQUIRED") || message.includes("legal_document_not_published")) setSubmitError("The required terms changed before payment. Review the current terms and try again.");
      else if (message.includes("LEGAL_CONFIGURATION_INCOMPLETE")) setSubmitError("Checkout is temporarily unavailable while Cleanr updates required terms.");
      else if (relationshipBlocked) setSubmitError("This relationship is paused or ended. Manage it or choose another CSP.");
      else if (message.includes("requested_provider_not_available_for_booking")) setSubmitError(`${requestedProviderName} isn't available for this arrival window. Choose another time, CSP, or let Cleanr match you.`);
      else if (message.includes("requested_provider_outside_service_radius")) setSubmitError(`${requestedProviderName} doesn't serve this exact address. Choose another CSP or let Cleanr match you.`);
      else if (message.includes("requested_provider_rejects_booking")) setSubmitError(`${requestedProviderName} isn't accepting this service or frequency right now.`);
      else if (message.includes("requested_provider_not_marketplace_available")) setSubmitError(`${requestedProviderName} is no longer accepting new marketplace bookings.`);
      else if (message.includes("PROVIDER_SUPPLY_BUILDING")) setSubmitError(state.requestedProviderId ? `${requestedProviderName} isn't available for this time. Choose another time or CSP.` : "No Cleanr CSP is available for this time. Choose another arrival window.");
      else if (message.includes("MARKET_NOT_ACTIVE")) setSubmitError("Booking is not open in this area yet.");
      else if (message.includes("UNSUPPORTED_SERVICE_AREA")) setSubmitError("Cleanr is not serving this ZIP yet.");
      else setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const appliedValue = valueSummary.acquisitionCreditCents > 0
    ? `${money(valueSummary.acquisitionCreditCents)} referral credit ready`
    : valueSummary.cleanrCreditBalanceCents > 0
      ? `${money(valueSummary.cleanrCreditBalanceCents)} Cleanr credit available`
      : null;

  return (
    <div className="space-y-4">
      {(appliedValue || state.priorityRequested || serviceRelationshipId || state.requestedProviderId) ? (
        <div className="border-y border-[#E4E7EC] bg-white py-3 text-[12px] leading-5 text-[#475467]">
          {appliedValue ? <p><span className="font-semibold text-[#166534]">Credit:</span> {appliedValue}. Applied automatically when eligible.</p> : null}
          {state.priorityRequested ? <p className={appliedValue ? "mt-1" : ""}><span className="font-semibold text-[#92400E]">Priority:</span> +{Math.round(priorityRate * 100)}% for short-notice service.</p> : null}
          {serviceRelationshipId ? <p className={(appliedValue || state.priorityRequested) ? "mt-1" : ""}><span className="font-semibold text-[#166534]">CSP:</span> Booking through your active relationship.</p> : state.requestedProviderId ? <p className={(appliedValue || state.priorityRequested) ? "mt-1" : ""}><span className="font-semibold text-[#166534]">Requested CSP:</span> {requestedProviderName}. Availability is rechecked before payment.</p> : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">Service</p>
          <p className="mt-1 text-[14px] font-semibold text-[#0B1220]">{state.serviceType ? customerFacingServiceLabel(state.serviceType) : "Not selected"}</p>
          <p className="mt-0.5 text-[12px] text-[#667085]">{state.homeDetails.bedrooms ?? "-"} bd · {state.homeDetails.bathrooms ?? "-"} ba{state.homeDetails.sqft ? ` · ${state.homeDetails.sqft} sq ft` : ""} · {state.frequency ?? "one-time"}</p>
        </div>
        <div className="border-t border-[#E4E7EC] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">When</p>
          <p className="mt-1 text-[14px] font-semibold text-[#0B1220]">{state.date ?? "Date not set"} · {state.time ?? "Time not set"}</p>
        </div>
        <div className="border-t border-[#E4E7EC] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">Where</p>
          <p className="mt-1 text-[13px] font-medium leading-5 text-[#0B1220]">{state.serviceAddress.verified ? state.serviceAddress.formatted : "Address not verified"}</p>
        </div>
        <div className="border-t border-[#E4E7EC] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">CSP</p>
          <p className="mt-1 text-[13px] font-medium text-[#0B1220]">{state.requestedProviderId ? requestedProviderName : "Let Cleanr match me"}</p>
        </div>
      </div>

      <details className="rounded-xl border border-[#E4E7EC] bg-white">
        <summary className="cursor-pointer list-none px-4 py-3 text-[12px] font-semibold text-[#475467]">More booking details</summary>
        <div className="space-y-3 border-t border-[#E4E7EC] px-4 py-3 text-[12px] leading-5 text-[#667085]">
          <div><span className="font-semibold text-[#0B1220]">Extras:</span> {state.extras.length ? state.extras.join(", ") : "None"}</div>
          <div><span className="font-semibold text-[#0B1220]">Contact:</span> {state.contact.name || "Name not set"} · {state.contact.email || "Email not set"} · {state.contact.phone || "Phone not set"}</div>
        </div>
      </details>

      {legalDocuments.length > 0 ? (
        <section className="rounded-2xl border border-[#D0D5DD] bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#667085]">Required before payment</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-semibold">
            {legalDocuments.map((document) => document.url ? (
              <a key={`${document.document_key}:${document.version}`} href={document.url} target="_blank" rel="noreferrer" className="text-[#0000FE] underline underline-offset-2">{document.title}</a>
            ) : (
              <span key={`${document.document_key}:${document.version}`} className="text-[#475467]">{document.title}</span>
            ))}
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-3 border-t border-[#E4E7EC] pt-3">
            <input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} className="mt-0.5 h-4 w-4" />
            <span className="text-[12px] leading-5 text-[#475467]">I have reviewed and agree to the required documents listed above.</span>
          </label>
        </section>
      ) : null}

      {submitError ? <div className="border-y border-red-200 bg-red-50 py-3 text-[12px] font-medium leading-5 text-red-600">{submitError}</div> : null}

      <Button type="button" onClick={handleConfirm} disabled={isSubmitting || !state.serviceAddress.verified} loading={isSubmitting} variant="primaryBlue" size="lg" fullWidth>
        {isSubmitting ? "Starting payment…" : "Continue to secure payment"}
      </Button>
      <p className="text-center text-[11px] leading-4 text-[#667085]">You'll see the final total before you're charged. Sign in only if needed.</p>
      <button type="button" onClick={onBack} className="w-full py-2 text-[12px] font-semibold text-[#475467]">Make changes</button>
      {legalDocuments.length === 0 ? <p className="text-center text-[10px] leading-4 text-[#98A2B3]">Any required legal documents will be shown for explicit review before payment.</p> : null}
    </div>
  );
}
