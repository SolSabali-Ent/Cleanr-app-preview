import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { listMyServiceAddressesForBooking, type BookingServiceAddress } from "../../lib/customerServiceAddressApi";
import { useBooking } from "../bookingStore";

interface StepAddressProps { onNext: () => void; onBack: () => void; }

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
  const [savedPlaces, setSavedPlaces] = useState<BookingServiceAddress[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [showManualForm, setShowManualForm] = useState(Boolean(state.serviceAddress.street));

  useEffect(() => {
    let active = true;
    setSavedLoading(true);
    void listMyServiceAddressesForBooking(state.zipcode)
      .then((rows) => {
        if (!active) return;
        setSavedPlaces(rows);
        if (rows.length === 0) setShowManualForm(true);
      })
      .catch(() => { if (active) setShowManualForm(true); })
      .finally(() => { if (active) setSavedLoading(false); });
    return () => { active = false; };
  }, [state.zipcode]);

  const isFormComplete = useMemo(() => Boolean(street.trim() && city.trim() && region.trim() && /^\d{5}(?:-\d{4})?$/.test(zip.trim())), [street, city, region, zip]);

  function useSavedPlace(place: BookingServiceAddress) {
    update({
      zipcode: place.zip.slice(0, 5),
      serviceAddress: {
        street: place.street,
        unit: place.unit ?? "",
        city: place.city,
        state: place.state,
        zip: place.zip,
        formatted: place.formattedAddress,
        lat: place.lat,
        lng: place.lng,
        verified: true,
      },
    });
    onNext();
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isFormComplete || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (state.zipcode && zip.slice(0, 5) !== state.zipcode.slice(0, 5)) throw new Error("This address needs to match the ZIP you used to check availability.");
      const { data, error: fnError } = await supabase.functions.invoke("geocode-service-address", {
        body: { street: street.trim(), unit: unit.trim() || null, city: city.trim(), state: region.trim().toUpperCase(), zip: zip.trim() },
      });
      if (fnError) throw fnError;
      const result = data as GeocodeResponse | null;
      if (!result?.verified || typeof result.lat !== "number" || typeof result.lng !== "number") {
        if (result?.error === "address_not_verified") throw new Error("We couldn't verify that street address. Check it and try again.");
        if (result?.error === "address_zip_mismatch") throw new Error("That address does not match the ZIP you entered.");
        throw new Error("We couldn't verify the service address right now. Please try again.");
      }
      update({
        zipcode: (result.zip ?? zip).slice(0, 5),
        serviceAddress: {
          street: result.street ?? street.trim(), unit: result.unit ?? unit.trim(), city: result.city ?? city.trim(), state: result.state ?? region.trim().toUpperCase(), zip: result.zip ?? zip.trim(),
          formatted: result.formatted ?? `${street.trim()}${unit.trim() ? `, ${unit.trim()}` : ""}, ${city.trim()}, ${region.trim().toUpperCase()} ${zip.trim()}`,
          lat: result.lat, lng: result.lng, verified: true,
        },
      });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't verify the service address.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0000FE]";
  const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500";

  return (
    <div className="space-y-5">
      {!savedLoading && savedPlaces.length > 0 ? (
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Saved places</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {savedPlaces.map((place, index) => (
              <button
                key={place.id}
                type="button"
                onClick={() => useSavedPlace(place)}
                className={`flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left ${index > 0 ? "border-t border-slate-200" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{place.label}</p>
                    {place.isDefault ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#027A48]"><CheckCircle2 className="h-3 w-3" /> Default</span> : null}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-600">{place.street}{place.unit ? `, Unit ${place.unit}` : ""}</p>
                  <p className="text-[11px] text-slate-500">{place.city}, {place.state} {place.zip}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-[#166534]">Use</span>
              </button>
            ))}
          </div>
          {!showManualForm ? <button type="button" onClick={() => setShowManualForm(true)} className="mt-3 w-full py-2 text-sm font-semibold text-slate-600">Use a different address</button> : null}
        </section>
      ) : null}

      {showManualForm ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {savedPlaces.length > 0 ? <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">New address</p> : null}
          <div className="space-y-3">
            <label className="block"><span className={labelClass}>Street address</span><input type="text" autoComplete="street-address" value={street} onChange={(e) => setStreet(e.target.value)} placeholder="123 Peachtree St NW" className={inputClass} /></label>
            <label className="block"><span className={labelClass}>Apartment / unit <span className="normal-case tracking-normal text-slate-400">(optional)</span></span><input type="text" autoComplete="address-line2" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit 4B" className={inputClass} /></label>
            <div className="grid grid-cols-5 gap-2">
              <label className="col-span-3 block"><span className={labelClass}>City</span><input type="text" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} /></label>
              <label className="col-span-2 block"><span className={labelClass}>State</span><input type="text" autoComplete="address-level1" value={region} maxLength={2} onChange={(e) => setRegion(e.target.value.toUpperCase())} className={inputClass} /></label>
            </div>
            <label className="block"><span className={labelClass}>ZIP code</span><input type="text" inputMode="numeric" autoComplete="postal-code" value={zip} onChange={(e) => setZip(e.target.value.replace(/[^0-9-]/g, "").slice(0, 10))} className={inputClass} /></label>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" disabled={!isFormComplete || loading} loading={loading} variant="primaryBlue" size="lg" fullWidth>{loading ? "Checking address…" : "Use this address"}</Button>
          <p className="text-center text-[10px] leading-4 text-slate-400">We verify the exact address for provider eligibility and safe arrival.</p>
        </form>
      ) : savedLoading ? <p className="py-4 text-sm text-slate-500">Loading saved places…</p> : null}
    </div>
  );
}
