import { useNavigate } from "react-router-dom";
import { useBookingStore } from "../../store/bookingStore";
import type { FrequencyOption } from "../../store/bookingStore";


const OPTIONS: { id: FrequencyOption; label: string; desc: string }[] = [
  { id: "one_time", label: "One-time", desc: "Perfect for a refresh or move." },
  { id: "weekly", label: "Weekly", desc: "Best for busy homes. ~20% off." },
  { id: "biweekly", label: "Every 2 weeks", desc: "Most popular. ~15% off." },
  { id: "monthly", label: "Every 4 weeks", desc: "For lower-traffic homes. ~10% off." },
];

export default function Frequency() {
  const navigate = useNavigate();
  const { frequency, setFrequency, totalPrice } = useBookingStore((s) => ({
    frequency: s.frequency,
    setFrequency: s.setFrequency,
    totalPrice: s.totalPrice,
  }));

  const handleContinue = () => {
    if (!frequency) return;
    navigate("/book/date-time");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-10 pb-8">
      <header className="mb-6">
        <p className="text-xs text-gray-500">Step 4 of 7</p>
        <h1 className="text-2xl font-bold mt-1">How often?</h1>
        <p className="text-gray-500 mt-2">
          Save more when you schedule recurring cleans.
        </p>
      </header>

      <main className="flex-1 space-y-3">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFrequency(opt.id)}
            className={`w-full border rounded-xl px-4 py-3 text-left transition ${
              frequency === opt.id
                ? "border-black bg-gray-100"
                : "border-gray-300 bg-white"
            }`}
          >
            <p className="font-semibold">{opt.label}</p>
            <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
          </button>
        ))}
      </main>

      <section className="mt-6 border-t pt-4">
        <div className="flex justify-between font-semibold text-lg">
          <span>Estimated total</span>
          <span>${totalPrice}</span>
        </div>

        <button
          onClick={handleContinue}
          disabled={!frequency}
          className={`w-full mt-4 py-3 rounded-xl text-lg font-semibold transition ${
            frequency ? "bg-black text-white" : "bg-gray-200 text-gray-500"
          }`}
        >
          Continue
        </button>
      </section>
    </div>
  );
}

