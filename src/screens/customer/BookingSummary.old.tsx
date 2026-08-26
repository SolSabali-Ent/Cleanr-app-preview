import { useNavigate } from "react-router-dom";
import { useBookingStore, ADDONS, PROVIDERS } from "../../store/bookingStore";

export default function BookingSummary() {
  const navigate = useNavigate();
  const booking = useBookingStore((s) => s);

  const provider = booking.providerId
    ? PROVIDERS.find((p) => p.id === booking.providerId)
    : null;

  const addonLabels = booking.addons
    .map((id) => ADDONS.find((a) => a.id === id)?.label)
    .filter(Boolean) as string[];

  const handleConfirm = () => {
    navigate("/book/payment");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-10 pb-8">
      <header className="mb-6">
        <p className="text-xs text-gray-500">Step 7 of 7</p>
        <h1 className="text-2xl font-bold mt-1">Review your booking</h1>
      </header>

      <main className="flex-1 space-y-4">
        <section className="border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Home details</h2>
          <p className="text-sm text-gray-700">
            ZIP {booking.zip} ·{" "}
            {booking.sqft ? `${booking.sqft.toLocaleString()} sq ft` : "Size not set"}
          </p>
          <p className="text-sm text-gray-700">
            {booking.bedrooms} bed · {booking.bathrooms} bath
          </p>
        </section>

        <section className="border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Schedule</h2>
          <p className="text-sm text-gray-700">
            {booking.date ? booking.date : "Date not selected"}
          </p>
          <p className="text-sm text-gray-700">
            {booking.timeSlot ? booking.timeSlot : "Time not selected"}
          </p>
        </section>

        <section className="border rounded-xl p-4 space-y-2">
          <h2 className="font-semibold mb-2">Add-ons</h2>
          {addonLabels.length === 0 ? (
            <p className="text-sm text-gray-500">No add-ons selected.</p>
          ) : (
            <ul className="list-disc list-inside text-sm text-gray-700">
              {addonLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="border rounded-xl p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
            {provider && (
              <img
                src={provider.imageUrl}
                alt={provider.name}
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="flex-1">
            <h2 className="font-semibold">Your cleaner</h2>
            {provider ? (
              <>
                <p className="text-sm text-gray-700">{provider.name}</p>
                <p className="text-xs text-gray-500">
                  ⭐ {provider.rating.toFixed(1)} · {provider.reviewsCount} reviews
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500">No provider selected.</p>
            )}
          </div>
        </section>

        <section className="border rounded-xl p-4 space-y-1">
          <div className="flex justify-between text-sm">
            <span>Base</span>
            <span>${booking.basePrice}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Add-ons</span>
            <span>${booking.addonsTotal}</span>
          </div>
          {booking.discount > 0 && (
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Recurring discount</span>
              <span>- ${booking.discount}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-lg mt-1">
            <span>Total due</span>
            <span>${booking.totalPrice}</span>
          </div>
        </section>
      </main>

      <button
        onClick={handleConfirm}
        disabled={!booking.totalPrice}
        className={`w-full mt-4 py-3 rounded-xl text-lg font-semibold transition ${
          booking.totalPrice ? "bg-black text-white" : "bg-gray-200 text-gray-500"
        }`}
      >
        Confirm & Continue to Payment
      </button>
    </div>
  );
}

