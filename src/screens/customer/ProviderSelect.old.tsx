import { useNavigate } from "react-router-dom";
import { useBookingStore, PROVIDERS } from "../../store/bookingStore";

export default function ProviderSelect() {
  const navigate = useNavigate();
  const { providerId, setProvider, totalPrice } = useBookingStore((s) => ({
    providerId: s.providerId,
    setProvider: s.setProvider,
    totalPrice: s.totalPrice,
  }));

  const handleContinue = () => {
    if (!providerId) return;
    navigate("/book/summary");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-10 pb-8">
      <header className="mb-6">
        <p className="text-xs text-gray-500">Step 6 of 7</p>
        <h1 className="text-2xl font-bold mt-1">Choose your pro</h1>
        <p className="text-gray-500 mt-2">
          All providers are vetted, background-checked, and insured.
        </p>
      </header>

      <main className="flex-1 space-y-4">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setProvider(p.id)}
            className={`w-full border rounded-2xl overflow-hidden flex flex-col text-left transition ${
              providerId === p.id
                ? "border-black bg-gray-100"
                : "border-gray-300 bg-white"
            }`}
          >
            <div className="h-32 w-full bg-gray-200 overflow-hidden">
              <img
                src={p.imageUrl}
                alt={p.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-3 space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-gray-600">
                  ⭐ {p.rating.toFixed(1)} · {p.reviewsCount} reviews
                </p>
              </div>
              <p className="text-xs text-gray-500">{p.tagline}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {p.badges.map((b) => (
                  <span
                    key={b}
                    className="text-[10px] px-2 py-1 rounded-full bg-gray-200 text-gray-700"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </main>

      <section className="mt-4 border-t pt-4">
        <div className="flex justify-between font-semibold text-lg mb-2">
          <span>Estimated total</span>
          <span>${totalPrice}</span>
        </div>
        <button
          onClick={handleContinue}
          disabled={!providerId}
          className={`w-full py-3 rounded-xl text-lg font-semibold transition ${
            providerId ? "bg-black text-white" : "bg-gray-200 text-gray-500"
          }`}
        >
          Continue
        </button>
      </section>
    </div>
  );
}

