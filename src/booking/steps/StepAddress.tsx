import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CheckCircle2, MapPin } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { listMyServiceAddressesForBooking, type BookingServiceAddress } from "../../lib/customerServiceAddressApi";
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
      .catch(() => {
        if (active) setShowManualForm(true);
      })
      .finally(() => {
        if (active) setSavedLoading(false);
      });

    return () => {
      active = false;
    };
  }, [state.zipcode]);

  const isFormComplete = useMemo(
    () => Boolean(street.trim() && city.trim() && region.trim() && /^\d{5}(?:-\d{4})?$/.test(zip.trim())),
    [street, city, region, zip],
  );

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
      if (state.zipcode && zip.slice(0, 5) !== state.zipcode.slice(0, 5)) {
        throw new Error("This address needs to match the ZIP you used to check availability.");
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
    <div className="space-y-5">
      {!savedLoading && savedPlaces.length > 0 ? (
        <section>
          <p className="mb-2 text-sm font-semibold text-slate-900">Choose a saved place</p>
          <div className="space-y-2">
            {savedPlaces.map((place) => (
              <button
                key={place.id}
                type="button"
                onClick={() => useSavedPlace(place)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#8DCC64]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3FAF1] text-[#166534]">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{place.label}</p>
                    {place.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10px] font-semibold text-[#027A48]">
                        <CheckCircle2 className="h-3 w-3" /> Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{place.street}{place.unit ? `, Unit ${place.unit}` : ""}</p>
                  <p className="text-xs text-slate-500">{place.city}, {place.state} {place.zip}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-[#166534]">Use</span>
              </button>
            ))}
          </div>

          {!showManualForm ? (
            <button
              type="button"
              onClick={() => setShowManualForm(true)}
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Use a different address
            </button>
          ) : null}
        </section>
      ) : null}

      {showManualForm ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          {savedPlaces.length > 0 ? <p className="text-sm font-semibold text-slate-900">New place</p> : null}
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
            {loading ? "Checking address…" : "Use this address →"}
          </Button>

          <p className="text-[11px] leading-5 text-center text-slate-500">
            We verify the exact service address so the right provider can find the home and confirm arrival safely.
          </p>
        </form>
      ) : savedLoading ? (
        <p className="text-sm text-slate-500">Loading your saved places...</p>
      ) : null}
    </div>
  );
}
