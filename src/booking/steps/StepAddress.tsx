import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { useBooking } from "../bookingStore";

interface StepAddressProps {
  onNext: () => void;
  onBack: () => void;
}

type GeocodeResponse = {
  verified?: boolean;
  formatted?: string;
  street?: string;
  unit?: string | null;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lng?: number;
  error?: string;
};

export function StepAddress({ onNext }: StepAddressProps) {
  const { state, update } = useBooking();
  const [street, setStreet] = useState(state.serviceAddress.street);
  const [unit, setUnit] = useState(state.serviceAddress.unit);
  const [city, setCity] = useState(state.serviceAddress.city || "Atlanta");
  const [region, setRegion] = useState(state.serviceAddress.state || "GA");
  const [zip, setZip] = useState(state.serviceAddress.zip || state.zipcode || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFormComplete = useMemo(
    () => Boolean(street.trim() && city.trim() && region.trim() && /^\d{5}(?:-\d{4})?$/.test(zip.trim())),
    [street, city, region, zip],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFormComplete || loading) return;

    setLoading(true);
    setError(null);
    try {
      if (state.zipcode && zip.slice(0, 5) !== state.zipcode.slice(0, 5)) {
        throw new Error("The service address ZIP must match the ZIP you used to check availability.");
      }

      const { data, error: fnError } = await supabase.functions.invoke("geocode-service-address", {
        body: {
          street: street.trim(),
          unit: unit.trim() || null,
          city: city.trim(),
          state: region.trim().toUpperCase(),
          zip: zip.trim(),
        },
      });

      if (fnError) throw fnError;
      const result = data as GeocodeResponse | null;
      if (!result?.verified || typeof result.lat !== "number" || typeof result.lng !== "number") {
        if (result?.error === "address_not_verified") {
          throw new Error("We couldn't verify that street address. Check it and try again.");
        }
        if (result?.error === "address_zip_mismatch") {
          throw new Error("That address does not match the ZIP you entered.");
        }
        throw new Error("We couldn't verify the service address right now. Please try again.");
      }

      update({
        zipcode: (result.zip ?? zip).slice(0, 5),
        serviceAddress: {
          street: result.street ?? street.trim(),
          unit: result.unit ?? unit.trim(),
          city: result.city ?? city.trim(),
          state: result.state ?? region.trim().toUpperCase(),
          zip: result.zip ?? zip.trim(),
          formatted:
            result.formatted ??
            `${street.trim()}${unit.trim() ? `, ${unit.trim()}` : ""}, ${city.trim()}, ${region.trim().toUpperCase()} ${zip.trim()}`,
          lat: result.lat,
          lng: result.lng,
          verified: true,
        },
      });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't verify the service address.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Street address</label>
          <input
            type="text"
            autoComplete="street-address"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="123 Peachtree St NW"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">Apartment / unit</label>
          <input
            type="text"
            autoComplete="address-line2"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Optional"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
          />
        </div>

        <div className="grid grid-cols-5 gap-2">
          <div className="col-span-3">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">City</label>
            <input
              type="text"
              autoComplete="address-level2"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[11px] font-medium text-slate-600 mb-1">State</label>
            <input
              type="text"
              autoComplete="address-level1"
              value={region}
              maxLength={2}
              onChange={(e) => setRegion(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-600 mb-1">ZIP code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/[^0-9-]/g, "").slice(0, 10))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="submit" disabled={!isFormComplete || loading} loading={loading} variant="primaryBlue" size="lg" fullWidth>
        {loading ? "Verifying address…" : "Verify address →"}
      </Button>

      <p className="text-[11px] leading-5 text-center text-slate-500">
        Cleanr uses the verified service location for provider matching and arrival verification. A ZIP code alone is never treated as a visit location.
      </p>
    </form>
  );
}
