import { useState } from "react";
import type { FormEvent } from "react";
import { Calendar } from "lucide-react";
import { useBooking } from "../bookingStore";
import { Button } from "../../components/ui/Button";
import { BOOKING_TIME_SLOT_CASES } from "../../lib/bookingSchedule";

interface StepDateTimeProps {
  onNext: () => void;
  onBack: () => void;
}

const TIME_WINDOWS = [...BOOKING_TIME_SLOT_CASES];

/** Format YYYY-MM-DD for display (e.g. "March 15, 2025"). */
function formatDateDisplay(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate + "T12:00:00");
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function StepDateTime({ onNext }: StepDateTimeProps) {
  const { state, update } = useBooking();
  const [date, setDate] = useState(state.date ?? "");
  const [time, setTime] = useState(state.time ?? "");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !time) return;

    update({ date, time });
    onNext();
  };

  const isValid = date && time;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="w-full min-w-0">
        <label className="block text-[11px] font-medium text-slate-600 mb-1">
          Choose a date
        </label>
        <div className="relative w-full min-w-0 rounded-xl border border-slate-300 bg-white pl-3 pr-10 py-2 min-h-[42px] flex items-center focus-within:outline-none focus-within:ring-2 focus-within:ring-[#0000FE]">
          <span
            className={`pointer-events-none ${date ? "text-sm text-slate-900" : "text-sm text-slate-400"}`}
            aria-hidden
          >
            {date ? formatDateDisplay(date) : "Pick a date"}
          </span>
          <Calendar
            className="w-4 h-4 text-slate-400 shrink-0 ml-auto pointer-events-none"
            aria-hidden
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="absolute inset-0 w-full h-full cursor-pointer z-10 opacity-[0.01]"
            style={{ fontSize: "16px" }}
            aria-label="Pick a date"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-slate-600 mb-1">
          Arrival window
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TIME_WINDOWS.map((window) => {
            const active = time === window;

            return (
              <button
                key={window}
                type="button"
                onClick={() => setTime(window)}
                className={[
                  "rounded-xl border px-3 py-2 text-xs text-left transition",
                  active
                    ? "border-[#0000FE] bg-[#EEF2FF]"
                    : "border-slate-200 bg-white",
                ].join(" ")}
              >
                {window}
              </button>
            );
          })}
        </div>
      </div>

      <Button type="submit" disabled={!isValid} variant="primaryBlue" size="lg" fullWidth>
        Continue →
      </Button>

      <p className="text-[11px] text-center text-slate-400">
        Your provider may arrive anytime within the selected window.
      </p>
    </form>
  );
}
