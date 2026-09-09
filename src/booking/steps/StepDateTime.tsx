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

function localDateInputValue(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isFutureWindow(date: string, window: string, nowMs = Date.now()): boolean {
  const normalized = normalizeBookingSchedule(date || null, window || null);
  if (!normalized) return false;
  return new Date(normalized.scheduledStartIso).getTime() > nowMs;
}

function percent(rate: number): string { return `${Math.round(rate * 100)}%`; }

export function StepDateTime({ onNext }: StepDateTimeProps) {
  const { state, update } = useBooking();
  const [searchParams] = useSearchParams();
  const priorityEntry = searchParams.get("priority") === "urgent";
  const adminTimeTestRequested = searchParams.get("time_test") === "1";
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [date, setDate] = useState(state.date ?? "");
  const [time, setTime] = useState(state.time ?? "");
  const [availability, setAvailability] = useState<SlotAvailability>({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [upsell, setUpsell] = useState<UpsellConfig>({ urgent_window_hours: 48, urgent_surcharge_rate: 0.25 });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasVerifiedLocation = state.serviceAddress.verified && typeof state.serviceAddress.lat === "number" && typeof state.serviceAddress.lng === "number";
  const today = localDateInputValue(new Date(nowMs));
  const timeTestMode = adminChecked && isAdmin && adminTimeTestRequested;

  useEffect(() => {
    let active = true;
    void supabase.rpc("is_admin").then(({ data, error }) => {
      if (!active) return;
      setIsAdmin(!error && data === true);
      setAdminChecked(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!adminChecked) return;
    if (!timeTestMode && date && date < today) {
      setDate("");
      setTime("");
    }
  }, [adminChecked, date, timeTestMode, today]);

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
    if (!adminChecked || !date || (!timeTestMode && date < today) || !hasVerifiedLocation) {
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
          const selectableByTime = timeTestMode || isFutureWindow(date, window);
          if (!normalized || !selectableByTime) { next[window] = 0; return; }
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
          if (time && ((next[time] ?? 0) < 1 || (!timeTestMode && !isFutureWindow(date, time)))) setTime("");
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
  }, [adminChecked, date, timeTestMode, today, hasVerifiedLocation, state.frequency, state.serviceAddress.lat, state.serviceAddress.lng, time]);

  const hasAnyAvailableSlot = useMemo(() => TIME_WINDOWS.some((window) => (timeTestMode || isFutureWindow(date, window, nowMs)) && (availability[window] ?? 0) > 0), [availability, date, nowMs, timeTestMode]);
  const selectedSchedule = useMemo(() => normalizeBookingSchedule(date || null, time || null), [date, time]);
  const selectedIsFuture = useMemo(() => Boolean(time && isFutureWindow(date, time, nowMs)), [date, time, nowMs]);
  const selectedIsAllowed = Boolean(time && (timeTestMode || selectedIsFuture));
  const selectedIsUrgent = useMemo(() => {
    if (!selectedSchedule) return false;
    const delta = new Date(selectedSchedule.scheduledStartIso).getTime() - nowMs;
    return delta > 0 && delta <= upsell.urgent_window_hours * 60 * 60 * 1000;
  }, [selectedSchedule, upsell.urgent_window_hours, nowMs]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !time || !selectedIsAllowed || (availability[time] ?? 0) < 1) return;
    update({ date, time, priorityRequested: selectedIsUrgent });
    onNext();
  };

  const dateAllowed = Boolean(date && (timeTestMode || date >= today));
  const isValid = Boolean(dateAllowed && time && selectedIsAllowed && (availability[time] ?? 0) > 0 && !loadingAvailability);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {timeTestMode ? (
        <div className="border-y border-violet-200 bg-violet-50 py-3 text-[12px] leading-5 text-violet-800">
          <span className="font-semibold">Admin test mode:</span> past booking times are available for end-to-end testing only.
        </div>
      ) : adminTimeTestRequested && adminChecked && !isAdmin ? (
        <div className="border-y border-amber-200 bg-amber-50 py-3 text-[12px] leading-5 text-amber-800">
          Time test mode is only available to a Cleanr admin account.
        </div>
      ) : null}

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
          <input type="date" min={timeTestMode ? undefined : today} value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-[0.01]" style={{ fontSize: "16px" }} aria-label="Pick a date" />
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
            const future = Boolean(date && isFutureWindow(date, window, nowMs));
            const selectableByTime = future || timeTestMode;
            const available = known && selectableByTime && providerCount > 0;
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
                {date ? <span className={`text-[11px] ${available ? "text-[#667085]" : "text-slate-400"}`}>{!future && timeTestMode ? (available ? `${providerCount} available · test` : "Unavailable") : !future ? "Time passed" : known ? (available ? `${providerCount} available` : "Unavailable") : ""}</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {selectedIsUrgent ? <p className="text-[11px] font-medium text-[#92400E]">This selected time includes the +{percent(upsell.urgent_surcharge_rate)} priority charge.</p> : null}
      {availabilityError ? <p className="text-[12px] font-medium text-red-500">{availabilityError}</p> : null}
      {date && !loadingAvailability && !availabilityError && Object.keys(availability).length > 0 && !hasAnyAvailableSlot ? (
        <div className="border-y border-amber-200 bg-amber-50 py-3 text-[12px] text-amber-800"><span className="font-semibold">No times available on this date.</span> Choose another day.</div>
      ) : null}

      <Button type="submit" disabled={!isValid} variant="primaryBlue" size="lg" fullWidth>Continue</Button>
      <p className="text-center text-[10px] text-slate-400">{timeTestMode ? "Admin test mode is on. Normal customers cannot book past times." : "We check the time again before payment."}</p>
    </form>
  );
}
