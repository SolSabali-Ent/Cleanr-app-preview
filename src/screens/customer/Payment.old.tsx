import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useBookingStore } from "../../store/bookingStore";

/**
 * NOTE:
 * This screen assumes there will be a backend endpoint at:
 *   POST /api/create-checkout-session
 * that returns a { url } for Stripe Checkout.
 *
 * For now, this implementation just simulates a short delay and
 * then navigates to the confirmation screen. Later, wire this up
 * to your real Stripe endpoint.
 */

export default function Payment() {
  const navigate = useNavigate();
  const totalPrice = useBookingStore((s) => s.totalPrice);

  useEffect(() => {
    if (!totalPrice) {
      navigate("/book/summary");
      return;
    }

    const timer = setTimeout(() => {
      // In real implementation:
      // await fetch("/api/create-checkout-session", { method: "POST", body: JSON.stringify({...}) })
      // const { url } = await res.json();
      // window.location.href = url;
      navigate("/book/confirmation");
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigate, totalPrice]);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold mb-2">Redirecting to payment...</h1>
        <p className="text-gray-600 mb-4">
          We&apos;re preparing your secure checkout. This is just a simulation for
          now. Stripe integration will be wired here later.
        </p>
        <p className="text-lg font-semibold">Amount: ${totalPrice}</p>
      </div>
    </div>
  );
}

