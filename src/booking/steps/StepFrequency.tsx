import { Check } from "lucide-react";
import { useBooking } from "../bookingStore";

interface StepFrequencyProps {
  onNext: () => void;
  onBack: () => void;
}

const options: {
  id: "one-time" | "weekly" | "bi-weekly" | "monthly";
  title: string;
  subtitle: string;
  badge?: string;
}[] = [
  { id: "weekly", title: "Weekly", subtitle: "Best value for busy households.", badge: "Save up to 20%" },
  { id: "bi-weekly", title: "Every 2 weeks", subtitle: "Most popular maintenance schedule.", badge: "Save up to 15%" },
  { id: "monthly", title: "Every 4 weeks", subtitle: "Good for lighter-traffic homes." },
  { id: "one-time", title: "One-time", subtitle: "For a single cleaning." },
];

export function StepFrequency({ onNext }: StepFrequencyProps) {
  const { state, update } = useBooking();

  const handleSelect = (id: "one-time" | "weekly" | "bi-weekly" | "monthly") => {
    update({ frequency: id });
    onNext();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {options.map((opt, index) => {
        const active = state.frequency === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelect(opt.id)}
            className={`flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition ${index > 0 ? "border-t border-slate-200" : ""} ${active ? "bg-[#F7F8FF]" : "bg-white"}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold text-[#0B1220]">{opt.title}</p>
                {opt.badge ? <span className="text-[11px] font-semibold text-[#0000FE]">{opt.badge}</span> : null}
              </div>
              <p className="mt-1 text-[12px] leading-5 text-[#667085]">{opt.subtitle}</p>
            </div>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-[#0000FE] bg-[#0000FE] text-white" : "border-slate-300 text-transparent"}`}>
              <Check className="h-3 w-3" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
