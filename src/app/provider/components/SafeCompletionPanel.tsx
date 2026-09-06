import { useEffect, useRef, useState } from "react";
import { Check, MapPin, ShieldCheck } from "lucide-react";
import type { Booking } from "../../../domain/booking";
import {
  finishProviderService,
  verifyProviderDeparture,
  type ProviderDepartureResult,
} from "../../../lib/providerCompletionApi";
import { providerRpcErrorMessage } from "../../../lib/providerTravelApi";
import { supabase } from "../../../lib/supabase";

type Props = {
  booking: Booking;
  checklistComplete: boolean;
  onBookingChange: (booking: Booking) => void;
  onCompleted: () => void;
};

function getLivePosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("location_unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) reject(new Error("location_permission_denied"));
        else if (error.code === error.TIMEOUT) reject(new Error("location_timeout"));
        else reject(new Error("location_unavailable"));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

function locationErrorMessage(error: unknown): string {
  const message = providerRpcErrorMessage(error);
  if (message.includes("provider_too_far_to_finish_service")) {
    return "Finish Service must be recorded while you are still at the service address.";
  }
  if (message.includes("location_permission_denied")) {
    return "Location access is required for the safety departure check. Allow location access and try again.";
  }
  if (message.includes("location_timeout")) {
    return "We couldn't verify your location in time. Make sure location services are on and try again.";
  }
  if (message.includes("location_unavailable")) {
    return "We couldn't access your current location. Turn on location services and try again.";
  }
  return message ? `Could not verify the visit: ${message}` : "Could not verify the visit. Try again.";
}

function departureCopy(result: ProviderDepartureResult | null): string {
  if (!result || result.distanceMeters == null) {
    return "Leave the property normally. Cleanr will verify that you are safely away before closing the visit.";
  }
  if (result.completed) return "Safe departure verified.";
  if (result.distanceMeters < 1000) {
    return `You're about ${Math.round(result.distanceMeters)} meters from the service address. The visit closes after ${Math.round(result.departureThresholdMeters ?? 300)} meters.`;
  }
  return "Cleanr is waiting for the safe-departure boundary to be verified.";
}

export default function SafeCompletionPanel({ booking, checklistComplete, onBookingChange, onCompleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departureResult, setDepartureResult] = useState<ProviderDepartureResult | null>(null);
  const [serviceFinishedAt, setServiceFinishedAt] = useState<string | null>(booking.service_finished_at ?? null);
  const lastCheckRef = useRef(0);
  const serviceFinished = Boolean(serviceFinishedAt);

  useEffect(() => {
    setServiceFinishedAt(booking.service_finished_at ?? null);
  }, [booking.service_finished_at]);

  useEffect(() => {
    if (booking.status !== "in_progress" || serviceFinishedAt) return;
    let mounted = true;
    void supabase
      .from("bookings")
      .select("service_finished_at")
      .eq("id", booking.id)
      .maybeSingle()
      .then(({ data, error: lookupError }) => {
        if (!mounted || lookupError) return;
        setServiceFinishedAt((data?.service_finished_at as string | null | undefined) ?? null);
      });
    return () => {
      mounted = false;
    };
  }, [booking.id, booking.status, serviceFinishedAt]);

  const verifyDeparture = async (lat: number, lon: number) => {
    const result = await verifyProviderDeparture(booking.id, lat, lon);
    setDepartureResult(result);
    if (result.completed && result.booking) {
      onBookingChange(result.booking);
      onCompleted();
    }
    return result;
  };

  useEffect(() => {
    if (!serviceFinished || booking.status !== "in_progress") return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastCheckRef.current < 20_000) return;
        lastCheckRef.current = now;
        void verifyDeparture(position.coords.latitude, position.coords.longitude).catch((watchError) => {
          console.warn("[safe-departure] background verification failed", providerRpcErrorMessage(watchError));
        });
      },
      () => {
        // Manual verification remains available when foreground location watching is interrupted.
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [booking.id, booking.status, serviceFinished]);

  const handleFinishService = async () => {
    if (!checklistComplete || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { lat, lon } = await getLivePosition();
      const updated = await finishProviderService(booking.id, lat, lon);
      setServiceFinishedAt(updated.service_finished_at ?? new Date().toISOString());
      onBookingChange(updated);
      setDepartureResult({ completed: false, distanceMeters: 0, departureThresholdMeters: 300, booking: null });
    } catch (finishError) {
      setError(locationErrorMessage(finishError));
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyDeparture = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { lat, lon } = await getLivePosition();
      await verifyDeparture(lat, lon);
    } catch (departureError) {
      setError(locationErrorMessage(departureError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-3 rounded-2xl border border-emerald-700/40 bg-emerald-950/30 p-4 shadow-md">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-200">
          {serviceFinished ? <ShieldCheck size={20} /> : <Check size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-100">
            {serviceFinished ? "Service finished — verify safe departure" : "Finish the service"}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-emerald-200/80">
            {serviceFinished
              ? departureCopy(departureResult)
              : "Complete the checklist, then mark the cleaning work finished while you are still at the home. The visit will stay open until Cleanr verifies that you have safely left the area."}
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-950/30 px-3 py-2.5">
          <p className="text-xs text-red-200">{error}</p>
        </div>
      ) : null}

      {!serviceFinished ? (
        <button
          disabled={!checklistComplete || busy}
          onClick={handleFinishService}
          className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? "Verifying location…" : checklistComplete ? "Mark Service Finished" : "Complete checklist first"}
        </button>
      ) : (
        <>
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-950/25 px-3 py-2.5">
            <div className="flex items-start gap-2">
              <MapPin size={14} className="mt-0.5 shrink-0 text-emerald-300" />
              <p className="text-[10px] leading-4 text-emerald-200/75">
                Cleanr checks only the latest live location needed to confirm departure. The customer does not receive your exact location.
              </p>
            </div>
          </div>
          <button
            disabled={busy}
            onClick={handleVerifyDeparture}
            className="mt-3 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy ? "Checking departure…" : "Verify I've safely left"}
          </button>
          <p className="mt-2 text-[10px] leading-4 text-emerald-200/60">
            If you cannot leave normally or feel unsafe, use Report Incident instead of forcing the visit closed.
          </p>
        </>
      )}
    </section>
  );
}
