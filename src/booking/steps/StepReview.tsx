import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useBooking } from "../bookingStore";
import { createBooking, createBookingCheckoutSession } from "../../lib/bookingApi";
import { setMyBookingServiceRelationshipContext } from "../../lib/bookingRelationshipApi";
import { recordBookingProgressEvent, serviceOptionKeyFromBookingService } from "../../lib/bookingProgress";
import { emitBookingAbandoned } from "../../lib/kinex/events";
import { customerFacingServiceLabel } from "../../lib/serviceCatalog";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";

interface StepReviewProps {
  onBack: () => void;
}

export function StepReview({ onBack }: StepReviewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useBooking();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const serviceRelationshipId = searchParams.get("relationship")?.trim() || null;

  const handleConfirm = async () => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        void recordBookingProgressEvent({
          eventType: "auth_required_checkout_blocked",
          currentStep: "review",
          zip: state.zipcode ?? null,
          serviceOptionKey: serviceOptionKeyFromBookingService(state.serviceType),
        });
        throw new Error("Please sign in before payment so we can confirm your booking identity.");
      }

      const bookingId = await createBooking(state);
      if (serviceRelationshipId) {
        await setMyBookingServiceRelationshipContext(bookingId, serviceRelationshipId);
      }
      void recordBookingProgressEvent({
        eventType: "booking_created_payment_not_started",
        currentStep: "review",
        bookingId,
        zip: state.zipcode ?? null,
        serviceOptionKey: serviceOptionKeyFromBookingService(state.serviceType),
        metadata: serviceRelationshipId
          ? { relationship_context: "customer_selected_existing_relationship" }
          : undefined,
      });
      // Durable booking_created Kinex truth is emitted by the booking insert outbox trigger.
      // This screen records funnel/navigation progress only; it does not author product truth.
      void recordBookingProgressEvent({
        eventType: "checkout_started_payment_not_completed",
        currentStep: "review",
        bookingId,
        zip: state.zipcode ?? null,
        serviceOptionKey: serviceOptionKeyFromBookingService(state.serviceType),
        metadata: {
          transport: "stripe_checkout_redirect",
          ...(serviceRelationshipId ? { relationship_context: "customer_selected_existing_relationship" } : {}),
        },
      });
      const { url } = await createBookingCheckoutSession(bookingId);
      window.location.assign(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "We couldn't start payment. Please try again.";
      if (
        message.includes("PROVIDER_SUPPLY_BUILDING") ||
        message.includes("MARKET_NOT_ACTIVE") ||
        message.includes("UNSUPPORTED_SERVICE_AREA")
      ) {
        const activationReason = message.includes("PROVIDER_SUPPLY_BUILDING")
          ? "provider_supply_building"
          : message.includes("UNSUPPORTED_SERVICE_AREA")
            ? "unsupported_service_area"
            : "market_not_active";
        void recordBookingProgressEvent({
          eventType: "booking_created_payment_not_started",
          currentStep: "review",
          zip: state.zipcode ?? null,
          serviceOptionKey: serviceOptionKeyFromBookingService(state.serviceType),
          metadata: { checkout_block_reason: activationReason },
        });
        void supabase.auth.getUser().then(({ data: { user } }) => {
          if (user?.id) {
            emitBookingAbandoned(user.id, "review_checkout_blocked", 0);
          }
        });
      }
      if (message.includes("PROVIDER_SUPPLY_BUILDING")) {
        setSubmitError("Cleanr providers are being added in your area. Booking is not open here yet.");
      } else if (message.includes("MARKET_NOT_ACTIVE")) {
        setSubmitError("Booking is not open in this area yet. Check back soon.");
      } else if (message.includes("UNSUPPORTED_SERVICE_AREA")) {
        setSubmitError("Cleanr is not serving this ZIP yet.");
      } else if (message.includes("invalid_service_relationship_context")) {
        setSubmitError("This Cleanr relationship is no longer available for this booking. Choose a CSP again or continue without relationship context.");
      } else {
        setSubmitError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {serviceRelationshipId ? (
        <div className="rounded-[14px] border border-[#BBF7D0] bg-[#F0FDF4] p-4">
          <p className="text-[13px] font-semibold text-[#166534]">Continuing an established Cleanr relationship</p>
          <p className="mt-1 text-[12px] leading-5 text-[#3F6212]">
            This booking will carry the relationship you selected into checkout. That context preserves provenance and continuity; it does not bypass Cleanr/Kinex fulfillment controls or create lock-in.
          </p>
        </div>
      ) : null}

      <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-4 space-y-3 text-sm">
        <div>
          <p className="text-[12px] font-medium text-[#667085] uppercase">
            Service
          </p>
          <p className="mt-1 text-[14px] font-medium text-[#0B1220]">
            {state.serviceType ? customerFacingServiceLabel(state.serviceType) : "Not selected"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[12px] font-medium text-[#667085] uppercase">
              Home
            </p>
            <p className="mt-1 text-[13px] font-medium text-[#0B1220]">
              {state.homeDetails.bedrooms ?? "-"} bd •{" "}
              {state.homeDetails.bathrooms ?? "-"} ba
            </p>
            {state.homeDetails.sqft && (
              <p className="text-[12px] font-medium text-[#667085]">
                Approx. {state.homeDetails.sqft} sq ft
              </p>
            )}
          </div>

          <div>
            <p className="text-[12px] font-medium text-[#667085] uppercase">
              Frequency
            </p>
            <p className="mt-1 text-[13px] font-medium text-[#0B1220]">
              {state.frequency ?? "One-time"}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[12px] font-medium text-[#667085] uppercase">
            Extras
          </p>
          {state.extras.length === 0 ? (
            <p className="mt-1 text-[13px] font-medium text-[#0B1220]">No add-ons selected.</p>
          ) : (
            <ul className="mt-1 text-[13px] font-medium text-[#0B1220] list-disc list-inside space-y-0.5">
              {state.extras.map((extra) => (
                <li key={extra}>{extra}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[12px] font-medium text-[#667085] uppercase">
              When
            </p>
            <p className="mt-1 text-[13px] font-medium text-[#0B1220]">
              {state.date ?? "Date not set"}
            </p>
            <p className="text-[12px] font-medium text-[#667085]">
              {state.time ?? "Time window not set"}
            </p>
          </div>

          <div>
            <p className="text-[12px] font-medium text-[#667085] uppercase">
              Where
            </p>
            <p className="mt-1 text-[13px] font-medium text-[#0B1220]">
              Zip code {state.zipcode || "—"}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[12px] font-medium text-[#667085] uppercase">
            Contact
          </p>
          <p className="mt-1 text-[13px] font-medium text-[#0B1220]">
            {state.contact.name || "Name not set"}
          </p>
          <p className="text-[12px] font-medium text-[#667085]">
            {state.contact.email || "Email not set"}
          </p>
          <p className="text-[12px] font-medium text-[#667085]">
            {state.contact.phone || "Phone not set"}
          </p>
        </div>
      </div>

      {submitError ? <p className="text-[12px] font-medium text-red-500">{submitError}</p> : null}
      {submitError?.toLowerCase().includes("sign in") ? (
        <Button type="button" variant="secondary" size="md" fullWidth onClick={() => navigate("/signin")}>
          Sign in to continue
        </Button>
      ) : null}
      <p className="text-[12px] text-center text-[#667085]">
        Final price is calculated and validated server-side before secure checkout.
      </p>

      <Button
        type="button"
        onClick={handleConfirm}
        disabled={isSubmitting}
        loading={isSubmitting}
        variant="primaryBlue"
        size="lg"
        fullWidth
      >
        {isSubmitting ? "Starting payment…" : "Continue to Secure Payment →"}
      </Button>

      <Button type="button" onClick={onBack} variant="secondary" size="lg" fullWidth>
        Back to make changes
      </Button>

      <p className="text-[12px] font-medium text-center text-[#667085]">
        By confirming, you agree to Cleanr&apos;s terms of service and
        cancellation policy.
      </p>
    </div>
  );
}
