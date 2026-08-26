import { useBooking } from "../bookingStore";
import {
  SERVICE_DISPLAY_NAME,
  WIZARD_SERVICE_CARDS,
  type ServiceOptionKey,
} from "../../lib/serviceCatalog";

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
    <div className="space-y-4">
      <div className="space-y-3">
        {WIZARD_SERVICE_CARDS.map((service) => {
          const active = state.serviceType === service.optionKey;

          return (
            <button
              key={service.optionKey}
              type="button"
              onClick={() => handleSelect(service.optionKey)}
              className={[
                "w-full flex items-center justify-between gap-3 rounded-2xl px-4 py-4 border transition text-left",
                active ? "border-[#0000FE] bg-[#EEF2FF]" : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 text-xl">{service.icon}</div>
                <div>
                  <p className="text-[16px] font-bold text-[#0B1220]">
                    {SERVICE_DISPLAY_NAME[service.optionKey]}
                  </p>
                  <p className="text-[13px] font-medium text-[#667085] mt-1">
                    {service.subtitle}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {service.badge && (
                  <span className="text-[12px] font-medium text-[#0000FE]">
                    {service.badge}
                  </span>
                )}
                <span className="text-[12px] font-medium text-[#667085]">
                  {service.priceLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[12px] font-medium text-center text-[#667085]">
        You can switch services later if your needs change.
      </p>
    </div>
  );
}
