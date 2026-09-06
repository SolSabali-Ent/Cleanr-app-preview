import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Calendar, Zap } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useBooking } from "../bookingStore";
import { Button } from "../../components/ui/Button";
import { BOOKING_TIME_SLOT_CASES, normalizeBookingSchedule } from "../../lib/bookingSchedule";
import { supabase } from "../../lib/supabase";

interface StepDateTimeProps {
  onNext: () => void;
  onBack: () => void;
}

const TIME_WINDOWS = [...BOOKING_TIME_SLOT_CASES];
type SlotAvailability = Record<string, number>;
type UpsellConfig = { urgent_window_hours: number; urgent_surcharge_rate: number };

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T12:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function StepDateTime({ onNext }: StepDateTimeProps) {
  const { state, update } = useBooking();
  const [searchParams] = useSearchParams();
  const priorityEntry = searchParams.get("priority") === "urgent";
  const [date, setDate] = useState(state.date ?? "");
  const [time, setTime] = useState(state.time ?? "");
  const [availability, setAvailability] = useState<SlotAvailability>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [upsell, setUpsell] = useState<UpsellConfig>({ urgent_window_hours: 48, urgent_surcharge_rate: 0.25 });

  const hasVerifiedLocation = state.serviceAddress.verified && typeof state.serviceAddress.lat === "number" && typeof state.serviceAddress.lng === "number";

  useEffect(() => {
    let active = true;
    void supabase.rpc("get_public_booking_upsell_config").then(({ data }) => {
      if (!active || !data || typeof data !== "object") return;
      const raw = data as Record<string, unknown>;
      const hours = Number(raw.urgent_window_hours);
      const rate = Number(raw.urgent_surcharge_rate);
      setUpsell({
        urgent_window_hours: Number.isFinite(hours) && hours > 0 ? hours : 48,
        urgent_surcharge_rate: Number.isFinite(rate) && rate >= 0 ? rate : 0.25,
      });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!date || !hasVerifiedLocation) {
      setAvailability({});
      setAvailabilityError(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoadingAvailability(true);
      setAvailabilityError(null);
      const next: SlotAvailability = {};
      try {
        await Promise.all(TIME_WINDOWS.map(async (window) => {
          const normalized = normalizeBookingSchedule(date, window);
          if (!normalized) {
            next[window] = 0;
            return;
          }
          const { data, error } = await supabase.rpc("count_checkout_eligible_providers_for_slot", {
            p_lat: state.serviceAddress.lat,
            p_lng: state.serviceAddress.lng,
            p_start: normalized.scheduledStartIso,
            p_end: normalized.scheduledEndIso,
            p_frequency: state.frequency ?? "one-time",
          });
          if (error) throw error;
          next[window] = typeof data === "number" ? Math.max(0, data) : 0;
        }));

        if (!cancelled) {
          setAvailability(next);
          if (time && (next[time] ?? 0) < 1) setTime("");
        }
      } catch (error) {
        console.error("[booking] Failed to load slot availability", error);
        if (!cancelled) {
          setAvailability({});
          setAvailabilityError("We couldn't load provider availability. Try another date or refresh.");
        }
      } finally {
        if (!cancelled) setLoadingAvailability(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [date, hasVerifiedLocation, state.frequency, state.serviceAddress.lat, state.serviceAddress.lng, time]);

  const hasAnyAvailableSlot = useMemo(() => TIME_WINDOWS.some((window) => (availability[window] ?? 0) > 0), [availability]);
  const selectedSchedule = useMemo(() => normalizeBookingSchedule(date || null, time || null), [date, time]);
  const selectedIsUrgent = useMemo(() => {
    if (!selectedSchedule) return false;
    const start = new Date(selectedSchedule.scheduledStartIso).getTime();
    const delta = start - Date.now();
    return delta > 0 && delta <= upsell.urgent_window_hours * 60 * 60 * 1000;
  }, [selectedSchedule, upsell.urgent_window_hours]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !time || (availability[time] ?? 0) < 1) return;
    update({ date, time, priorityRequested: selectedIsUrgent });
    onNext();
  };

  const isValid = Boolean(date && time && (availability[time] ?? 0) > 0 && !loadingAvailability);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {priorityEntry ? (
        <div className="rounded-2xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-[#FEF3C7] p-2 text-[#92400E]"><Zap className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-semibold text-[#78350F]">Need a cleaning soon?</p>
              <p className="mt-1 text-xs leading-5 text-[#92400E]">
                Choose an available time within the next {upsell.urgent_window_hours} hours. Short-notice cleanings include a {percent(upsell.urgent_surcharge_rate)} priority charge.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="w-full min-w-0">
        <label className="block text-[11px] font-medium text-slate-600 mb-1">Choose a date</label>
        <div className="relative w-full min-w-0 rounded-xl border border-slate-300 bg-white pl-3 pr-10 py-2 min-h-[42px] flex items-center focus-within:outline-none focus-within:ring-2 focus-within:ring-[#0000FE]">
          <span className={`pointer-events-none ${date ? "text-sm text-slate-900" : "text-sm text-slate-400"}`} aria-hidden>{date ? formatDateDisplay(date) : "Pick a date"}</span>
          <Calendar className="w-4 h-4 text-slate-400 shrink-0 ml-auto pointer-events-none" aria-hidden />
          <input
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setTime(""); }}
            className="absolute inset-0 w-full h-full cursor-pointer z-10 opacity-[0.01]"
            style={{ fontSize: "16px" }}
            aria-label="Pick a date"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-1">
          <label className="block text-[11px] font-medium text-slate-600">Arrival window</label>
          {loadingAvailability ? <span className="text-[11px] text-slate-400">Checking availability…</span> : null}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TIME_WINDOWS.map((window) => {
            const active = time === window;
            const providerCount = availability[window] ?? 0;
            const known = Object.prototype.hasOwnProperty.call(availability, window);
            const available = known && providerCount > 0;
            const disabled = loadingAvailability || !available;
            return (
              <button
                key={window}
                type="button"
                disabled={disabled}
                onClick={() => setTime(window)}
                className={["rounded-xl border px-3 py-2 text-xs text-left transition", active ? "border-[#0000FE] bg-[#EEF2FF] text-slate-900" : available ? "border-slate-200 bg-white text-slate-900" : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"].join(" ")}
              >
                <span className="block font-medium">{window}</span>
                {known ? <span className="mt-1 block text-[10px]">{available ? `${providerCount} provider${providerCount === 1 ? "" : "s"} available` : "Unavailable"}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {selectedIsUrgent ? (
        <div className="rounded-xl border border-[#F59E0B]/40 bg-[#FFFBEB] p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-[#78350F]">Priority cleaning</p>
              <p className="mt-0.5 text-[11px] leading-5 text-[#92400E]">This short-notice time includes a {percent(upsell.urgent_surcharge_rate)} priority charge.</p>
            </div>
            <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[11px] font-semibold text-[#92400E]">+{percent(upsell.urgent_surcharge_rate)}</span>
          </div>
        </div>
      ) : null}

      {availabilityError ? <p className="text-[12px] font-medium text-red-500">{availabilityError}</p> : null}
      {date && !loadingAvailability && !availabilityError && Object.keys(availability).length > 0 && !hasAnyAvailableSlot ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-[12px] font-semibold text-amber-900">No Cleanr provider is available on this date.</p>
          <p className="mt-1 text-[11px] leading-5 text-amber-800">Choose another date to see available arrival windows.</p>
        </div>
      ) : null}

      <Button type="submit" disabled={!isValid} variant="primaryBlue" size="lg" fullWidth>Continue →</Button>
      <p className="text-[11px] text-center text-slate-400">Availability and final pricing are checked again before payment.</p>
    </form>
  );
}
