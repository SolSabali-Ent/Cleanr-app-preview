/**
 * Legacy booking wizard screen (pre–CleanrBookingFlow). Residential options use serviceCatalog display names.
 * "office" is outside the v1 residential service_domain; not written by the current /book wizard.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Home, Boxes, Truck } from "lucide-react";
import { useBookingStore } from "../../store/bookingStore";
import { SERVICE_DISPLAY_NAME } from "../../lib/serviceCatalog";

type ServiceId = "standard" | "deep" | "moveout" | "office";

const SERVICES: {
  id: ServiceId;
  label: string;
  desc: string;
  badge?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  fromPrice: string;
}[] = [
  {
    id: "standard",
    label: SERVICE_DISPLAY_NAME.standard,
    desc: "For tidy homes that need a regular reset.",
    badge: "Most popular",
    icon: Home,
    fromPrice: "From $99",
  },
  {
    id: "deep",
    label: SERVICE_DISPLAY_NAME.deep,
    desc: "Inside appliances, baseboards, and detail work.",
    badge: "Best for first visit",
    icon: Sparkles,
    fromPrice: "From $149",
  },
  {
    id: "moveout",
    label: SERVICE_DISPLAY_NAME.moveout,
    desc: "Turnkey clean between tenants or when moving.",
    icon: Truck,
    fromPrice: "Custom quote",
  },
  {
    id: "office",
    label: "Office / Commercial",
    desc: "For offices, studios, and small commercial spaces.",
    icon: Boxes,
    fromPrice: "Custom quote",
  },
];

export default function ServiceTypeScreen() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ServiceId | null>(null);
  const store = useBookingStore((s) => s as any);

  const handleContinue = () => {
    if (!selected) return;

    if (store && typeof store.setServiceType === "function") {
      store.setServiceType(selected);
    }

    // Placeholder: next step will be ZIP/location screen
    navigate("/zip");
  };

  return (
    <div className="min-h-screen bg-cleanr-bg flex flex-col px-5 pt-10 pb-8">
      <header className="mb-6">
        <p className="text-xs text-gray-500">Step 1 of 7</p>
        <h1 className="mt-1 text-2xl font-bold">What do you need cleaned?</h1>
        <p className="mt-2 text-sm text-gray-600">
          Choose the option that best matches your home or space. You can adjust
          details later.
        </p>
      </header>

      <main className="flex-1 space-y-3">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          const isActive = selected === service.id;

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => setSelected(service.id)}
              className={`w-full text-left rounded-2xl border px-4 py-4 bg-white transition flex gap-3 ${
                isActive
                  ? "border-cleanr-primary shadow-cleanr-card"
                  : "border-gray-200"
              }`}
            >
              <div className="mt-1">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center ${
                    isActive
                      ? "bg-cleanr-primary text-white"
                      : "bg-cleanr-primary/10 text-cleanr-primary"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{service.label}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {service.desc}
                    </p>
                  </div>
                  <div className="text-right">
                    {service.badge && (
                      <p className="inline-block rounded-full bg-cleanr-primary/10 text-[10px] font-semibold px-2 py-0.5 text-cleanr-primary mb-1">
                        {service.badge}
                      </p>
                    )}
                    <p className="text-xs text-gray-600">
                      {service.fromPrice}
                    </p>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </main>

      <section className="mt-5">
        <button
          onClick={handleContinue}
          disabled={!selected}
          className={`cleanr-btn-primary ${
            !selected ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          Continue
        </button>
        <p className="mt-2 text-[11px] text-center text-gray-500">
          You can switch services later if your needs change.
        </p>
      </section>
    </div>
  );
}

