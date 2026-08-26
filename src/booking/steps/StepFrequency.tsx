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
  {
    id: "weekly",
    title: "Weekly",
    subtitle: "Best value for busy households.",
    badge: "Save up to 20%",
  },
  {
    id: "bi-weekly",
    title: "Every 2 weeks",
    subtitle: "Most popular maintenance schedule.",
    badge: "Save up to 15%",
  },
  {
    id: "monthly",
    title: "Every 4 weeks",
    subtitle: "Good for lighter traffic homes.",
  },
  {
    id: "one-time",
    title: "One-time",
    subtitle: "Perfect for seasonal or special occasions.",
  },
];

export function StepFrequency({ onNext }: StepFrequencyProps) {
  const { state, update } = useBooking();

  const handleSelect = (id: "one-time" | "weekly" | "bi-weekly" | "monthly") => {
    update({ frequency: id });
    onNext();
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {options.map((opt) => {
          const active = state.frequency === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              className={[
                "w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-3 border transition text-left",
                active ? "border-[#0000FE] bg-[#EEF2FF]" : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <div>
                <p className="text-[16px] font-bold text-[#0B1220]">
                  {opt.title}
                </p>
                <p className="text-[13px] font-medium text-[#667085] mt-1">{opt.subtitle}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {opt.badge && (
                  <span className="text-[12px] font-medium text-[#0000FE]">
                    {opt.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[12px] font-medium text-center text-[#667085]">
        You can adjust frequency at any time inside your Cleanr account.
      </p>
    </div>
  );
}
