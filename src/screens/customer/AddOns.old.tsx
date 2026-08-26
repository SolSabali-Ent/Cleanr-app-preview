import { useNavigate } from "react-router-dom";
import { useBookingStore, ADDONS } from "../../store/bookingStore";
import type { AddOnId } from "../../store/bookingStore";

export default function AddOns() {
  const navigate = useNavigate();
  const { addons, setAddons, basePrice, addonsTotal, totalPrice, recalcPricing } =
    useBookingStore((s) => ({
      addons: s.addons,
      setAddons: s.setAddons,
      basePrice: s.basePrice,
      addonsTotal: s.addonsTotal,
      totalPrice: s.totalPrice,
      recalcPricing: s.recalcPricing,
    }));

  const toggle = (id: AddOnId) => {
    let next: AddOnId[];
    if (addons.includes(id)) {
      next = addons.filter((x) => x !== id);
    } else {
      next = [...addons, id];
    }
    setAddons(next);
    recalcPricing();
  };

  const handleContinue = () => {
    navigate("/book/frequency");
  };

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-10 pb-8">
      <header className="mb-6">
        <p className="text-xs text-gray-500">Step 3 of 7</p>
        <h1 className="text-2xl font-bold mt-1">Any extras?</h1>
        <p className="text-gray-500 mt-2">
          Add-on services to customize your clean. You can skip this if you like.
        </p>
      </header>

      <main className="flex-1 space-y-3">
        {ADDONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            className={`w-full border rounded-xl px-4 py-3 flex items-center justify-between text-left transition ${
              addons.includes(item.id)
                ? "border-black bg-gray-100"
                : "border-gray-300 bg-white"
            }`}
          >
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-xs text-gray-500">+${item.price}</p>
            </div>
            <div
              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                addons.includes(item.id) ? "border-black bg-black" : "border-gray-400"
              }`}
            >
              {addons.includes(item.id) && (
                <span className="text-[10px] text-white">&#10003;</span>
              )}
            </div>
          </button>
        ))}
      </main>

      <section className="mt-6 border-t pt-4">
        <div className="flex justify-between text-sm mb-1">
          <span>Base</span>
          <span>${basePrice}</span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span>Add-ons</span>
          <span>${addonsTotal}</span>
        </div>
        <div className="flex justify-between font-semibold text-lg">
          <span>Estimated total</span>
          <span>${totalPrice}</span>
        </div>

        <button
          onClick={handleContinue}
          className="w-full mt-4 py-3 rounded-xl text-lg font-semibold bg-black text-white"
        >
          Continue
        </button>
      </section>
    </div>
  );
}
