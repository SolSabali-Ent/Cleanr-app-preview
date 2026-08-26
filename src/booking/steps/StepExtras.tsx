import { useBooking } from "../bookingStore";
import { Button } from "../../components/ui/Button";

interface StepExtrasProps {
  onNext: () => void;
  onBack: () => void;
}

const extrasList: { id: string; label: string; desc: string }[] = [
  {
    id: "inside-fridge",
    label: "Inside fridge",
    desc: "Shelves, drawers and door compartments.",
  },
  {
    id: "inside-oven",
    label: "Inside oven",
    desc: "Deep clean of oven interior.",
  },
  {
    id: "interior-windows",
    label: "Interior windows",
    desc: "Glass, sills and tracks where reachable.",
  },
  {
    id: "baseboards",
    label: "Baseboards",
    desc: "Detail dusting and wiping of baseboards.",
  },
  {
    id: "laundry",
    label: "Laundry add-on",
    desc: "Fold and put away laundry (up to 2 loads).",
  },
];

export function StepExtras({ onNext }: StepExtrasProps) {
  const { state, toggleExtra } = useBooking();

  const handleContinue = () => {
    onNext();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {extrasList.map((extra) => {
          const active = state.extras.includes(extra.id);

          return (
            <button
              key={extra.id}
              type="button"
              onClick={() => toggleExtra(extra.id)}
              className={[
                "w-full rounded-2xl px-4 py-3 border flex flex-col text-left transition",
                active ? "border-[#0000FE] bg-[#EEF2FF]" : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <p className="text-[16px] font-bold text-[#0B1220]">
                {extra.label}
              </p>
              <p className="text-[13px] font-medium text-[#667085] mt-1">{extra.desc}</p>
            </button>
          );
        })}
      </div>

      <Button type="button" onClick={handleContinue} variant="primaryBlue" size="lg" fullWidth>
        Continue →
      </Button>

      <p className="text-[12px] font-medium text-center text-[#667085]">
        Add-ons are priced separately and shown in your final quote.
      </p>
    </div>
  );
}
