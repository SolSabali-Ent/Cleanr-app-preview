import { useNavigate } from "react-router-dom";
import { useBookingStore } from "../../store/bookingStore";
import { useState, useEffect } from "react";

const SQFT_OPTIONS = [600, 800, 1000, 1200, 1500, 1800, 2200, 2600];
const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];
const BATHROOM_OPTIONS = [1, 2, 3, 4, 5];

export default function HomeDetails() {
  const navigate = useNavigate();
  const { zip, sqft, bedrooms, bathrooms, setHomeDetails } = useBookingStore(
    (s) => ({
      zip: s.zip,
      sqft: s.sqft,
      bedrooms: s.bedrooms,
      bathrooms: s.bathrooms,
      setHomeDetails: s.setHomeDetails,
    })
  );

  const [localSqft, setLocalSqft] = useState<string>(sqft ? String(sqft) : "");
  const [localBedrooms, setLocalBedrooms] = useState<number>(
    bedrooms ?? BEDROOM_OPTIONS[0]
  );
  const [localBathrooms, setLocalBathrooms] = useState<number>(
    bathrooms ?? BATHROOM_OPTIONS[0]
  );

  useEffect(() => {
    if (!zip) {
      navigate("/book/start");
    }
  }, [zip, navigate]);

  const handleContinue = () => {
    const sqftNumber = Number(localSqft) || 0;
    setHomeDetails(sqftNumber, localBedrooms, localBathrooms);
    navigate("/book/add-ons");
  };

  const canContinue =
    localSqft.trim().length > 0 && Number(localSqft) > 0 && localBedrooms && localBathrooms;

  return (
    <div className="min-h-screen bg-white flex flex-col px-6 pt-10 pb-8">
      <header className="mb-6">
        <p className="text-xs text-gray-500">Step 2 of 7</p>
        <h1 className="text-2xl font-bold mt-1">Tell us about your home</h1>
        <p className="text-gray-500 mt-2">
          ZIP <span className="font-semibold">{zip}</span>
        </p>
      </header>

      <main className="flex-1 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Approx. square footage</label>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {SQFT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLocalSqft(String(option))}
                className={`border rounded-xl py-2 text-sm font-medium ${
                  localSqft === String(option)
                    ? "border-black bg-gray-100"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                {option.toLocaleString()} sq ft
              </button>
            ))}
          </div>
          <input
            type="number"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
            placeholder="Or enter a custom size"
            value={localSqft}
            onChange={(e) => setLocalSqft(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Bedrooms</label>
            <div className="grid grid-cols-3 gap-2">
              {BEDROOM_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLocalBedrooms(option)}
                  className={`border rounded-xl py-2 text-sm ${
                    localBedrooms === option
                      ? "border-black bg-gray-100"
                      : "border-gray-300 text-gray-700"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Bathrooms</label>
            <div className="grid grid-cols-3 gap-2">
              {BATHROOM_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLocalBathrooms(option)}
                  className={`border rounded-xl py-2 text-sm ${
                    localBathrooms === option
                      ? "border-black bg-gray-100"
                      : "border-gray-300 text-gray-700"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <button
        onClick={handleContinue}
        disabled={!canContinue}
        className={`w-full mt-6 py-3 rounded-xl text-lg font-semibold transition ${
          canContinue
            ? "bg-black text-white"
            : "bg-gray-200 text-gray-500 cursor-not-allowed"
        }`}
      >
        Continue
      </button>
    </div>
  );
}
