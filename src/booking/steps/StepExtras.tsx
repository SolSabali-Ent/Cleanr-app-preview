import { Check } from "lucide-react";
import { useBooking } from "../bookingStore";
import { Button } from "../../components/ui/Button";

interface StepExtrasProps {
  onNext: () => void;
  onBack: () => void;
}

const extrasList: { id: string; label: string; desc: string }[] = [
  { id: "inside-fridge", label: "Inside fridge", desc: "Shelves, drawers, and door compartments." },
  { id: "inside-oven", label: "Inside oven", desc: "Deep clean of the oven interior." },
  { id: "interior-windows", label: "Interior windows", desc: "Glass, sills, and reachable tracks." },
  { id: "baseboards", label: "Baseboards", desc: "Detail dusting and wiping." },
  { id: "laundry", label: "Laundry add-on", desc: "Fold and put away up to 2 loads." },
];

export function StepExtras({ onNext }: StepExtrasProps) {
  const { state, toggleExtra } = useBooking();

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {extrasList.map((extra, index) => {
          const active = state.extras.includes(extra.id);
          return (
            <button
              key={extra.id}
              type="button"
              onClick={() => toggleExtra(extra.id)}
              className={`flex min-h-[68px] w-full items-center gap-3 px-4 py-3 text-left transition ${index > 0 ? "border-t border-slate-200" : ""} ${active ? "bg-[#F7F8FF]" : "bg-white"}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-[#0B1220]">{extra.label}</p>
                <p className="mt-1 text-[12px] leading-5 text-[#667085]">{extra.desc}</p>
              </div>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${active ? "border-[#0000FE] bg-[#0000FE] text-white" : "border-slate-300 text-transparent"}`}>
                <Check className="h-3 w-3" />
              </span>
            </button>
          );
        })}
      </div>

      <Button type="button" onClick={onNext} variant="primaryBlue" size="lg" fullWidth>
        Continue
      </Button>
      <p className="text-center text-[11px] text-[#98A2B3]">Optional · pricing appears before payment.</p>
    </div>
  );
}
