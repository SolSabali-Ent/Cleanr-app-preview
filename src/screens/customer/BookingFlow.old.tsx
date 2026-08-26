import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

type BookingStepId =
  | "address"
  | "homeDetails"
  | "serviceType"
  | "frequency"
  | "dateTime"
  | "provider"
  | "summary";

interface BookingStep {
  id: BookingStepId;
  label: string;
}

const BOOKING_STEPS: BookingStep[] = [
  { id: "address", label: "Address" },
  { id: "homeDetails", label: "Home details" },
  { id: "serviceType", label: "Service" },
  { id: "frequency", label: "Frequency" },
  { id: "dateTime", label: "Date & time" },
  { id: "provider", label: "Cleaner" },
  // summary is shown at the end but not in the progress pills
];

export interface BookingAddress {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
}

interface BookingFlowProps {
  // later we can inject bookingStore actions here
  onAddressSaved?: (address: BookingAddress) => void;
}

export default function BookingFlow({ onAddressSaved }: BookingFlowProps) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentStep = BOOKING_STEPS[currentIndex];

  const [address, setAddress] = useState<BookingAddress>({
    street: "",
    unit: "",
    city: "",
    state: "",
    zip: "",
  });

  const totalSteps = BOOKING_STEPS.length;
  const stepNumber = currentIndex + 1;

  const handleBack = () => {
    if (currentIndex === 0) {
      navigate(-1); // back to welcome
    } else {
      setCurrentIndex((i) => i - 1);
    }
  };

  const handleAddressSubmit = (data: BookingAddress) => {
    setAddress(data);
    if (onAddressSaved) onAddressSaved(data);
    // TODO: later persist to bookingStore
    setCurrentIndex((i) => Math.min(i + 1, totalSteps - 1));
  };

  const renderStepContent = () => {
    switch (currentStep.id) {
      case "address":
        return (
          <AddressStep
            initialValue={address}
            onSubmit={handleAddressSubmit}
          />
        );
      case "homeDetails":
        return (
          <HomeDetailsStep
            initialValue={{ sqft: "", bedrooms: "", bathrooms: "" }}
            onSubmit={(_data) => {
              setCurrentIndex((i) => i + 1);
            }}
          />
        );
      case "serviceType":
        return (
          <ServiceTypeStep
            initialValue={null}
            onSubmit={(_type) => {
              // later: bookingStore.setServiceType(_type);
              setCurrentIndex((i) => i + 1);
            }}
          />
        );
      default:
        // placeholders for now, we'll flesh these out step by step
        return (
          <div className="py-6">
            <p className="text-sm font-medium text-slate-900 mb-2">
              {currentStep.label}
            </p>
            <p className="text-xs text-slate-500">
              This step UI hasn&apos;t been built yet. We&apos;ll layer it in
              after address.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top area */}
      <header className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm shadow-slate-200 active:scale-[0.97] transition"
        >
          <ArrowLeft className="h-4 w-4 text-slate-700" />
        </button>
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Book a cleaning
          </span>
          <span className="text-sm font-medium text-slate-900">
            {currentStep.label}
          </span>
        </div>
      </header>

      {/* Progress pills */}
      <div className="px-4 mb-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Step {stepNumber} of {totalSteps}
          </p>
          <p className="text-[11px] text-slate-400">
            Cleanr • Instant pricing
          </p>
        </div>
        <div className="mt-2 flex gap-1.5">
          {BOOKING_STEPS.map((step, index) => {
            const isActive = index === currentIndex;
            const isCompleted = index < currentIndex;
            return (
              <div
                key={step.id}
                className={[
                  "h-1.5 flex-1 rounded-full transition-all",
                  isActive
                    ? "bg-[#8dcc64]"
                    : isCompleted
                    ? "bg-[#8dcc64]/40"
                    : "bg-slate-200",
                ].join(" ")}
              />
            );
          })}
        </div>
      </div>

      {/* Hero explainer area (Zeely-style top content) */}
      <div className="px-4 mb-4">
        <h1 className="text-xl font-semibold text-slate-900 leading-snug">
          Cleaning that fits your home.
        </h1>
        <p className="mt-1.5 text-xs text-slate-600">
          We use your address and home details to match you with vetted Cleanr
          Service Providers nearby.
        </p>
      </div>

      {/* Bottom card wizard – Zeely style */}
      <div className="mt-auto bg-white rounded-t-3xl shadow-[0_-18px_40px_rgba(15,23,42,0.16)] px-5 pt-4 pb-6">
        {renderStepContent()}
      </div>
    </div>
  );
}

/* ----------------- Address Step ----------------- */

interface AddressStepProps {
  initialValue: BookingAddress;
  onSubmit: (address: BookingAddress) => void;
}

function AddressStep({ initialValue, onSubmit }: AddressStepProps) {
  const [form, setForm] = useState<BookingAddress>(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = (key: keyof BookingAddress, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // basic validation: require street, city, state, zip
    if (!form.street || !form.city || !form.state || !form.zip) return;
    setIsSubmitting(true);
    // in a real app we might validate/normalize here
    onSubmit(form);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mini header inside card */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
          <MapPin className="h-4 w-4 text-[#0000fe]" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-900">
            Where should we clean?
          </p>
          <p className="text-[11px] text-slate-500">
            Enter the address you want us to service.
          </p>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Street address
          </label>
          <input
            type="text"
            value={form.street}
            onChange={(e) => updateField("street", e.target.value)}
            placeholder="123 Maple St"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8dcc64] focus:border-transparent"
          />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              Unit / Apt (optional)
            </label>
            <input
              type="text"
              value={form.unit ?? ""}
              onChange={(e) => updateField("unit", e.target.value)}
              placeholder="Apt 4B"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8dcc64] focus:border-transparent"
            />
          </div>
          <div className="w-24">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              ZIP
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={form.zip}
              onChange={(e) => updateField("zip", e.target.value)}
              placeholder="30303"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8dcc64] focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              City
            </label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              placeholder="Atlanta"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8dcc64] focus:border-transparent"
            />
          </div>
          <div className="w-20">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              State
            </label>
            <input
              type="text"
              value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
              placeholder="GA"
              maxLength={2}
              className="w-full uppercase rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8dcc64] focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        type="submit"
        disabled={
          isSubmitting ||
          !form.street ||
          !form.city ||
          !form.state ||
          !form.zip
        }
        className="mt-1 w-full rounded-2xl bg-[#8dcc64] py-3 text-sm font-semibold text-white shadow-md shadow-[#8dcc64]/40 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99] transition"
      >
        Next
      </button>

      <p className="text-[11px] text-center text-slate-400">
        We&apos;ll verify your address before confirming your booking.
      </p>
    </form>
  );
}

/* ----------------- Home Details Step ----------------- */

interface HomeDetails {
  sqft: string;
  bedrooms: string;
  bathrooms: string;
}

interface HomeDetailsStepProps {
  initialValue: HomeDetails;
  onSubmit: (data: HomeDetails) => void;
}

function HomeDetailsStep({ initialValue, onSubmit }: HomeDetailsStepProps) {
  const [form, setForm] = useState<HomeDetails>(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const update = (key: keyof HomeDetails, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isValid = () => {
    return (
      Number(form.sqft) > 0 &&
      Number(form.bedrooms) >= 0 &&
      Number(form.bathrooms) >= 0
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isValid()) return;
    setIsSubmitting(true);
    onSubmit(form);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-900">
          Tell us about your home
        </p>
        <p className="text-[11px] text-slate-500">
          This helps Cleanr estimate time & match the right provider.
        </p>
      </div>

      <div className="space-y-3">

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Approx. square footage
          </label>
          <input
            type="number"
            min={0}
            placeholder="1200"
            value={form.sqft}
            onChange={(e) => update("sqft", e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5
              text-sm placeholder-slate-400 text-slate-900
              focus:outline-none focus:ring-2 focus:ring-[#8dcc64] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Bedrooms
          </label>
          <input
            type="number"
            min={0}
            placeholder="3"
            value={form.bedrooms}
            onChange={(e) => update("bedrooms", e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5
              text-sm placeholder-slate-400 text-slate-900
              focus:outline-none focus:ring-2 focus:ring-[#8dcc64] focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">
            Bathrooms
          </label>
          <input
            type="number"
            min={0}
            placeholder="2"
            value={form.bathrooms}
            onChange={(e) => update("bathrooms", e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5
              text-sm placeholder-slate-400 text-slate-900
              focus:outline-none focus:ring-2 focus:ring-[#8dcc64] focus:border-transparent"
          />
        </div>

      </div>

      <button
        type="submit"
        disabled={!isValid() || isSubmitting}
        className="w-full rounded-2xl bg-[#8dcc64] py-3 text-sm font-semibold text-white
          shadow-md shadow-[#8dcc64]/40 disabled:opacity-60 disabled:cursor-not-allowed
          active:scale-[0.99] transition"
      >
        Next
      </button>

    </form>
  );
}

/* ----------------- Service Type Step ----------------- */

type CleaningServiceType = "standard" | "deep" | "moveout";

interface ServiceTypeStepProps {
  initialValue: CleaningServiceType | null;
  onSubmit: (type: CleaningServiceType) => void;
}

function ServiceTypeStep({ initialValue, onSubmit }: ServiceTypeStepProps) {
  const [selected, setSelected] = useState<CleaningServiceType | null>(
    initialValue
  );

  const services: {
    id: CleaningServiceType;
    title: string;
    desc: string;
    est: string;
  }[] = [
    {
      id: "standard",
      title: "Standard clean",
      desc: "Perfect for maintenance cleanings and upkeep.",
      est: "2–3 hrs",
    },
    {
      id: "deep",
      title: "Deep clean",
      desc: "Recommended every 3–4 months for a thorough refresh.",
      est: "3–5 hrs",
    },
    {
      id: "moveout",
      title: "Move-in / Move-out",
      desc: "Full wall-to-wall detailing for relocating.",
      est: "4–6 hrs",
    },
  ];

  const handleNext = () => {
    if (!selected) return;
    onSubmit(selected);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-sm font-medium text-slate-900">
          What type of cleaning do you need?
        </p>
        <p className="text-[11px] text-slate-500">
          Pick the service that best fits your home right now.
        </p>
      </div>

      <div className="space-y-3">
        {services.map((service) => {
          const active = selected === service.id;

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => setSelected(service.id)}
              className={[
                "w-full text-left rounded-2xl px-4 py-4 border transition",
                active
                  ? "border-[#8dcc64] bg-[#8dcc64]/10"
                  : "border-slate-200 bg-white",
              ].join(" ")}
            >
              <p
                className={[
                  "text-sm font-semibold",
                  active ? "text-slate-900" : "text-slate-800",
                ].join(" ")}
              >
                {service.title}
              </p>
              <p className="text-xs text-slate-500 mt-1">{service.desc}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Estimated: {service.est}
              </p>
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <button
        disabled={!selected}
        onClick={handleNext}
        className="w-full rounded-2xl bg-[#8dcc64] py-3 text-sm font-semibold text-white
          shadow-md shadow-[#8dcc64]/40 disabled:opacity-60 disabled:cursor-not-allowed
          active:scale-[0.99] transition"
      >
        Next
      </button>

    </div>
  );
}
