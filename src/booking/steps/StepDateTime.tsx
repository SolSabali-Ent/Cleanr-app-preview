import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Calendar } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useBooking } from "../bookingStore";
import { Button } from "../../components/ui/Button";
import { BOOKING_TIME_SLOT_CASES, normalizeBookingSchedule } from "../../lib/bookingSchedule";
import { supabase } from "../../lib/supabase";

interface StepDateTimeProps { onNext: () => void; onBack: () => void; }

const TIME_WINDOWS = [...BOOKING_TIME_SLOT_CASES];
type SlotAvailability = Record<string, number>;
type UpsellConfig = { urgent_window_hours: number; urgent_surcharge_rate: number };

function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T12:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function percent(rate: number): string { return `${Math.round(rate * 100)}%`; }

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
      setUpsell({ urgent_window_hours: Number.isFinite(hours) && hours > 0 ? hours : 48, urgent_surcharge_rate: Number.isFinite(rate) && rate >= 0 ? rate : 0.25 });
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
          if (!normalized) { next[window] = 0; return; }
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
        if (!cancelled) { setAvailability({}); setAvailabilityError("We couldn't load availability. Try another date or refresh."); }
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
    const delta = new Date(selectedSchedule.scheduledStartIso).getTime() - Date.now();
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
        <div className="border-y border-[#F59E0B]/30 bg-[#FFFBEB] py-3 text-[12px] leading-5 text-[#92400E]">
          Priority times within {upsell.urgent_window_hours} hours include a <span className="font-semibold">+{percent(upsell.urgent_surcharge_rate)}</span> charge.
        </div>
      ) : null}

      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Date</label>
        <div className="relative flex min-h-[46px] w-full items-center rounded-xl border border-slate-300 bg-white pl-3 pr-10 focus-within:ring-2 focus-within:ring-[#0000FE]">
          <span className={date ? "text-sm text-slate-900" : "text-sm text-slate-400"}>{date ? formatDateDisplay(date) : "Pick a date"}</span>
          <Calendar className="ml-auto h-4 w-4 text-slate-400" aria-hidden />
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-[0.01]" style={{ fontSize: "16px" }} aria-label="Pick a date" />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Arrival window</label>
          {loadingAvailability ? <span className="text-[11px] text-slate-400">Checking…</span> : null}
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {TIME_WINDOWS.map((window, index) => {
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
                className={`flex min-h-[58px] w-full items-center justify-between gap-3 px-4 py-3 text-left ${index > 0 ? "border-t border-slate-200" : ""} ${active ? "bg-[#F7F8FF]" : available ? "bg-white" : "bg-slate-50"}`}
              >
                <span className={`text-sm font-semibold ${available ? "text-slate-900" : "text-slate-400"}`}>{window}</span>
                {known ? <span className={`text-[11px] ${available ? "text-[#667085]" : "text-slate-400"}`}>{available ? `${providerCount} available` : "Unavailable"}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {selectedIsUrgent ? <p className="text-[11px] font-medium text-[#92400E]">This selected time includes the +{percent(upsell.urgent_surcharge_rate)} priority charge.</p> : null}
      {availabilityError ? <p className="text-[12px] font-medium text-red-500">{availabilityError}</p> : null}
      {date && !loadingAvailability && !availabilityError && Object.keys(availability).length > 0 && !hasAnyAvailableSlot ? (
        <div className="border-y border-amber-200 bg-amber-50 py-3 text-[12px] text-amber-800"><span className="font-semibold">No availability on this date.</span> Choose another day.</div>
      ) : null}

      <Button type="submit" disabled={!isValid} variant="primaryBlue" size="lg" fullWidth>Continue</Button>
      <p className="text-center text-[10px] text-slate-400">Availability is checked again before payment.</p>
    </form>
  );
}
