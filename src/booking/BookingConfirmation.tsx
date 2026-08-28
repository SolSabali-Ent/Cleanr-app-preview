/**
 * Post-checkout booking acknowledgment screen.
 *
 * This screen reads durable Stripe payment truth; it does not produce the canonical
 * `booking_confirmed` Kinex event. The Stripe webhook owns payment capture and the
 * corresponding durable Kinex/outbox events. `Booking.status === "confirmed"` is a
 * later service-lifecycle state and must not be used as payment truth here.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getBooking } from "../lib/bookingApi";
import type { Booking } from "../domain/booking";
import { track } from "../lib/analytics";
import { recordBookingProgressEvent, serviceOptionKeyFromBookingService } from "../lib/bookingProgress";
import { emitBookingAbandoned } from "../lib/kinex/events";
import { customerFacingServiceLabel } from "../lib/serviceCatalog";
import { CheckCircle } from "lucide-react";
import { InstallCTA } from "../components/InstallCTA";
import { Button } from "../components/ui/Button";

function bookingHasCapturedPaymentTruth(booking: Booking): boolean {
  return Boolean(booking.stripe_payment_intent_id);
}

export default function BookingConfirmation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("bookingId");
  const paymentCancelled = searchParams.get("payment") === "cancelled";
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) {
      navigate("/", { replace: true });
      return;
    }
    void getBooking(bookingId).then((b) => {
      setBooking(b);
      setLoading(false);
      if (b) {
        const paymentConfirmed = bookingHasCapturedPaymentTruth(b);
        track(paymentConfirmed ? "booking_confirmed" : "booking_request_received", { bookingId });
      }
    });
  }, [bookingId, navigate]);

  useEffect(() => {
    if (!bookingId || !booking || bookingHasCapturedPaymentTruth(booking)) return;
    let mounted = true;
    const intervalId = window.setInterval(() => {
      void getBooking(bookingId).then((latest) => {
        if (!mounted || !latest) return;
        setBooking(latest);
      });
    }, 3000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [bookingId, booking]);

  useEffect(() => {
    if (!paymentCancelled || !bookingId) return;
    if (typeof sessionStorage !== "undefined") {
      const dedupeKey = `cleanr_checkout_canceled_progress:${bookingId}`;
      if (sessionStorage.getItem(dedupeKey) === "1") return;
      sessionStorage.setItem(dedupeKey, "1");
    }
    void recordBookingProgressEvent({
      eventType: "checkout_canceled",
      currentStep: "booking_confirmation",
      bookingId,
      serviceOptionKey: serviceOptionKeyFromBookingService(booking?.service_type ?? null),
      metadata: { payment_status: "canceled" },
    });

    if (booking?.customer_id) {
      emitBookingAbandoned(booking.customer_id, "checkout_canceled", 0);
    }
  }, [paymentCancelled, bookingId, booking]);

  const handleDone = () => {
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FB] flex items-center justify-center px-4">
        <p className="text-[14px] font-medium text-[#667085]">Loading...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#F7F8FB] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-[20px] shadow-[0_10px_30px_rgba(15,23,42,0.08)] p-8 text-center">
          <p className="text-[14px] font-medium text-[#667085] mb-6">Booking not found.</p>
          <Button onClick={() => navigate("/")} variant="primaryBlue" size="lg" fullWidth>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const whenLabel =
    booking.scheduled_start &&
    new Date(booking.scheduled_start).toLocaleDateString();
  const paymentConfirmed = bookingHasCapturedPaymentTruth(booking);

  return (
    <div className="min-h-screen bg-[#F7F8FB] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-[20px] shadow-[0_10px_30px_rgba(15,23,42,0.08)] p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-[#ECFDF3] flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-[#8DCC64]" />
          </div>
        </div>
        <h1 className="text-[22px] font-bold text-[#0B1220] mb-2">
          {paymentConfirmed ? "Booking Confirmed!" : "Booking Request Received"}
        </h1>
        <p className="text-[14px] font-medium text-[#667085] mb-6">
          {paymentConfirmed
            ? "Your service is confirmed. We&apos;ll email a confirmation when your email is on file."
            : paymentCancelled
              ? "Your booking request is saved, but payment was not completed. Complete payment to confirm this booking."
              : "Your booking request was created, but payment is still pending. We&apos;ll confirm your booking after payment is received."}
        </p>
        {!paymentConfirmed ? (
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[14px] p-3 mb-6 text-left">
            <p className="text-[12px] font-medium text-[#92400E]">
              Payment status: {paymentCancelled ? "Canceled" : "Pending"}
            </p>
            <p className="text-[12px] mt-1 text-[#78350F]">
              {paymentCancelled
                ? "Return to booking to complete checkout when you&apos;re ready."
                : "Payment may still be processing. Booking confirmation appears only after Stripe payment success is recorded on this booking."}
            </p>
          </div>
        ) : null}
        <div className="bg-white border border-[#E5E7EB] rounded-[14px] p-4 mb-6 text-left space-y-2">
          <div>
            <span className="text-[12px] font-medium text-[#667085]">Service:</span>
            <p className="text-[14px] font-medium text-[#0B1220]">
              {customerFacingServiceLabel(booking.service_type)}
            </p>
          </div>
          {whenLabel && (
            <div>
              <span className="text-[12px] font-medium text-[#667085]">When:</span>
              <p className="text-[14px] font-medium text-[#0B1220]">
                {whenLabel}
              </p>
            </div>
          )}
          <div>
            <span className="text-[12px] font-medium text-[#667085]">Address:</span>
            <p className="text-[14px] font-medium text-[#0B1220]">{booking.address}</p>
          </div>
        </div>
        <Link
          to={`/app/bookings/${booking.id}/prep`}
          className="block w-full min-h-[52px] rounded-2xl border border-[#E5E7EB] bg-white py-4 px-6 text-center text-sm font-semibold text-[#0B1220] mb-3 hover:bg-slate-50"
        >
          Before your visit — save access details
        </Link>
        <p className="text-[11px] text-[#667085] mb-3 text-center">
          Sign in to the same account you used to book. Visit details require the in-app Bookings area.
        </p>
        <Button onClick={handleDone} variant="primaryBlue" size="lg" fullWidth>
          Back to Home
        </Button>
        <div className="mt-4">
          <InstallCTA />
        </div>
      </div>
    </div>
  );
}
