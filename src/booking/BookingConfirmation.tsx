/**
 * Post-checkout booking acknowledgment screen.
 * Stripe/webhook state remains payment truth; this screen only reads it.
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { getBooking } from "../lib/bookingApi";
import type { Booking } from "../domain/booking";
import { track } from "../lib/analytics";
import { recordBookingProgressEvent, serviceOptionKeyFromBookingService } from "../lib/bookingProgress";
import { emitBookingAbandoned } from "../lib/kinex/events";
import { customerFacingServiceLabel } from "../lib/serviceCatalog";
import { InstallCTA } from "../components/InstallCTA";
import { Button } from "../components/ui/Button";

function bookingHasCapturedPaymentTruth(booking: Booking): boolean {
  return Boolean(booking.stripe_payment_intent_id);
}

function formatWhen(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
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
      if (b) track(bookingHasCapturedPaymentTruth(b) ? "booking_confirmed" : "booking_request_received", { bookingId });
    });
  }, [bookingId, navigate]);

  useEffect(() => {
    if (!bookingId || !booking || bookingHasCapturedPaymentTruth(booking)) return;
    let mounted = true;
    const intervalId = window.setInterval(() => {
      void getBooking(bookingId).then((latest) => { if (mounted && latest) setBooking(latest); });
    }, 3000);
    return () => { mounted = false; window.clearInterval(intervalId); };
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
    if (booking?.customer_id) emitBookingAbandoned(booking.customer_id, "checkout_canceled", 0);
  }, [paymentCancelled, bookingId, booking]);

  if (loading) {
    return <div className="mx-auto flex min-h-screen max-w-[480px] items-center justify-center bg-[#F7F8FB] px-5 text-sm text-[#667085]">Loading booking…</div>;
  }

  if (!booking) {
    return (
      <div className="mx-auto min-h-screen max-w-[480px] bg-[#F7F8FB] px-5 py-12 text-center">
        <h1 className="text-xl font-semibold text-[#0B1220]">Booking not found</h1>
        <Button onClick={() => navigate("/")} variant="primaryBlue" size="lg" fullWidth className="mt-6">Back to Cleanr</Button>
      </div>
    );
  }

  const paymentConfirmed = bookingHasCapturedPaymentTruth(booking);

  return (
    <div className="mx-auto min-h-screen max-w-[480px] bg-[#F7F8FB] px-5 py-10 text-[#0B1220]">
      <header className="mb-7">
        {paymentConfirmed ? (
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#ECFDF3] text-[#166534]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        ) : null}
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#667085]">{paymentConfirmed ? "Booked" : "Payment pending"}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">{paymentConfirmed ? "Your cleaning is confirmed." : paymentCancelled ? "Your booking is saved." : "We're confirming payment."}</h1>
        <p className="mt-2 text-sm leading-6 text-[#667085]">
          {paymentConfirmed
            ? "We'll keep the visit, CSP, messages, and updates together in Cleanr."
            : paymentCancelled
              ? "Payment wasn't completed, so this visit is not confirmed yet."
              : "Stripe is still processing. This page will update when payment is recorded."}
        </p>
      </header>

      {!paymentConfirmed ? (
        <div className="mb-5 border-y border-amber-200 bg-amber-50 py-3 text-xs leading-5 text-amber-900">
          <span className="font-semibold">Payment: {paymentCancelled ? "Canceled" : "Pending"}.</span>{" "}
          {paymentCancelled ? "Return to booking when you're ready to finish checkout." : "Don't create another booking while this payment is processing."}
        </div>
      ) : null}

      <div className="mb-6 overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">Service</p>
          <p className="mt-1 text-sm font-semibold">{customerFacingServiceLabel(booking.service_type)}</p>
        </div>
        <div className="border-t border-[#E4E7EC] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">When</p>
          <p className="mt-1 text-sm font-semibold">{formatWhen(booking.scheduled_start)}</p>
        </div>
        <div className="border-t border-[#E4E7EC] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#98A2B3]">Where</p>
          <p className="mt-1 text-sm leading-5">{booking.address}</p>
        </div>
      </div>

      {paymentConfirmed ? (
        <>
          <Button onClick={() => navigate(`/app/bookings/${booking.id}`)} variant="primaryBlue" size="lg" fullWidth>View booking</Button>
          <Link to={`/app/bookings/${booking.id}/prep`} className="mt-3 flex min-h-[56px] items-center justify-between rounded-xl border border-[#E4E7EC] bg-white px-4 py-3 text-sm font-semibold">
            <span><span className="block">Add access details</span><span className="mt-0.5 block text-[11px] font-normal text-[#667085]">Helpful before your CSP arrives.</span></span>
            <span className="text-[#98A2B3]">›</span>
          </Link>
        </>
      ) : paymentCancelled ? (
        <Button onClick={() => navigate("/book")} variant="primaryBlue" size="lg" fullWidth>Return to booking</Button>
      ) : (
        <Button onClick={() => navigate(`/app/bookings/${booking.id}`)} variant="secondary" size="lg" fullWidth>View booking status</Button>
      )}

      {paymentConfirmed ? <p className="mt-4 text-center text-[11px] text-[#667085]">Everything for this visit now lives in your Bookings area.</p> : null}
      <div className="mt-5"><InstallCTA /></div>
    </div>
  );
}
