import { Check } from "lucide-react";
import { useBooking } from "../bookingStore";
import { SERVICE_DISPLAY_NAME, WIZARD_SERVICE_CARDS, type ServiceOptionKey } from "../../lib/serviceCatalog";

interface StepServiceProps {
  onNext: () => void;
  onBack: () => void;
}

export function StepService({ onNext }: StepServiceProps) {
  const { state, update } = useBooking();

  const handleSelect = (optionKey: ServiceOptionKey) => {
    update({ serviceType: optionKey });
    onNext();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {WIZARD_SERVICE_CARDS.map((service, index) => {
        const active = state.serviceType === service.optionKey;
        return (
          <button
            key={service.optionKey}
            type="button"
            onClick={() => handleSelect(service.optionKey)}
            className={`flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left transition ${index > 0 ? "border-t border-slate-200" : ""} ${active ? "bg-[#F7F8FF]" : "bg-white"}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold text-[#0B1220]">{SERVICE_DISPLAY_NAME[service.optionKey]}</p>
                {service.badge ? <span className="text-[11px] font-semibold text-[#0000FE]">{service.badge}</span> : null}
              </div>
              <p className="mt-1 text-[12px] leading-5 text-[#667085]">{service.subtitle}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[12px] font-medium text-[#667085]">{service.priceLabel}</span>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${active ? "border-[#0000FE] bg-[#0000FE] text-white" : "border-slate-300 text-transparent"}`}>
                <Check className="h-3 w-3" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
