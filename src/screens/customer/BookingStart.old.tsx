import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useBookingStore } from "../../store/bookingStore";

export default function BookingStart() {
  const navigate = useNavigate();
  const [zipInput, setZipInput] = useState("");
  const setZip = useBookingStore((s) => s.setZip);
  const reset = useBookingStore((s) => s.reset);

  const handleContinue = () => {
    if (zipInput.length === 5) {
      reset();
      setZip(zipInput);
      navigate("/book/home-details");
    }
  };

  const isValid = zipInput.length === 5 && /^\d+$/.test(zipInput);

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-10 pb-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Cleanr</h1>
        <p className="mt-2 text-gray-600">
          The easiest way to book trusted home cleaning in your city.
        </p>
      </header>

      <main className="flex-1 flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-3">
            Where do you need cleaning?
          </h2>
          <p className="text-gray-500 mb-4">
            Start with your ZIP code so we can check availability.
          </p>

          <input
            type="text"
            maxLength={5}
            inputMode="numeric"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="ZIP CODE"
            value={zipInput}
            onChange={(e) => setZipInput(e.target.value)}
          />

          <p className="mt-2 text-xs text-gray-400">
            We currently serve select areas. More cities coming soon.
          </p>
        </div>

        <button
          onClick={handleContinue}
          disabled={!isValid}
          className={`w-full mt-8 py-3 rounded-xl text-lg font-semibold transition 
            ${
              isValid
                ? "bg-black text-white"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
        >
          Continue
        </button>
      </main>
    </div>
  );
}
