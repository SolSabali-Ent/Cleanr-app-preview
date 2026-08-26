import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import BottomSheet, { type Snap } from "../../../components/ui/BottomSheet";
import { getProviderCalendarEvents, type ProviderCalendarEvent } from "../../../api/providerCalendar";
import { supabase } from "../../../lib/supabase";
import {
  CSP_CARD_PADDING,
  CSP_INPUT,
  CSP_PRIMARY_BUTTON,
  CSP_SECTION_GAP,
  CSP_SURFACE,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

type CalendarTab = "agenda" | "availability" | "month";
type RangePreset = "today" | "7d" | "30d";

type PlatformFlags = {
  calendar_enabled: boolean;
  insights_enabled: boolean;
};

type AvailabilityRow = {
  id: string | null;
  day_of_week: number;
  day_label: string;
  active: boolean;
  start_time: string;
  end_time: string;
  timezone: string;
};

const DAY_ROWS: Array<{ day_of_week: number; day_label: string }> = [
  { day_of_week: 0, day_label: "Sunday" },
  { day_of_week: 1, day_label: "Monday" },
  { day_of_week: 2, day_label: "Tuesday" },
  { day_of_week: 3, day_label: "Wednesday" },
  { day_of_week: 4, day_label: "Thursday" },
  { day_of_week: 5, day_label: "Friday" },
  { day_of_week: 6, day_label: "Saturday" },
];

function parsePlatformFlag(value: string | null | undefined, fallback: boolean): boolean {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function formatCurrency(cents: number | null): string {
  if (typeof cents !== "number") return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
}

function getDateRange(preset: RangePreset) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  if (preset === "today") {
    end.setDate(end.getDate());
  } else if (preset === "7d") {
    end.setDate(end.getDate() + 6);
  } else {
    end.setDate(end.getDate() + 29);
  }
  end.setHours(23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

type CalendarDayGroup = {
  dayKey: string;
  label: string;
  events: ProviderCalendarEvent[];
};

function groupCalendarDayGroups(eventSource: ProviderCalendarEvent[]): CalendarDayGroup[] {
  const grouped = new Map<string, ProviderCalendarEvent[]>();
  const sorted = [...eventSource].sort(
    (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
  );
  for (const event of sorted) {
    const key = event.start_at.slice(0, 10);
    const current = grouped.get(key) ?? [];
    current.push(event);
    grouped.set(key, current);
  }
  return Array.from(grouped.entries()).map(([dayKey, dayEvents]) => ({
    dayKey,
    label: new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    events: dayEvents,
  }));
}

/** 30-minute slots from 06:00 through 22:00 (inclusive), `HH:mm` for DB compatibility. */
const AVAIL_TIME_OPTIONS: string[] = (() => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const out: string[] = [];
  for (let h = 6; h <= 21; h++) {
    out.push(`${pad(h)}:00`);
    out.push(`${pad(h)}:30`);
  }
  out.push("22:00");
  return out;
})();

function clampTimeToOptions(raw: string): string {
  const t = raw.length >= 5 ? raw.slice(0, 5) : "09:00";
  if (AVAIL_TIME_OPTIONS.includes(t)) return t;
  const parts = t.split(":");
  const hh = Number(parts[0]);
  const mm = Number(parts[1]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return "09:00";
  const mins = hh * 60 + mm;
  let best = AVAIL_TIME_OPTIONS[0];
  let bestDiff = Infinity;
  for (const opt of AVAIL_TIME_OPTIONS) {
    const [oh, om] = opt.split(":").map(Number);
    const d = Math.abs(oh * 60 + om - mins);
    if (d < bestDiff) {
      bestDiff = d;
      best = opt;
    }
  }
  return best;
}

function formatTimeOptionLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function AvailTimeSelect({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (hhmm: string) => void;
}) {
  const safe = clampTimeToOptions(value);
  return (
    <div className="min-w-0 w-full max-w-full box-border">
      <label
        htmlFor={id}
        className="block text-[10px] font-semibold uppercase tracking-wide mb-1"
        style={{ color: "rgba(148, 163, 184, 0.95)" }}
      >
        {label}
      </label>
      <div className="relative w-full min-w-0 max-w-full">
        <select
          id={id}
          disabled={disabled}
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="avail-time-select w-full min-w-0 max-w-full box-border rounded-2xl border border-slate-700/70 bg-slate-900/70 pl-3 pr-10 py-3 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/60 h-12 relative z-[2] pointer-events-auto touch-manipulation disabled:cursor-not-allowed disabled:opacity-40"
        >
          {AVAIL_TIME_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {formatTimeOptionLabel(opt)}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 z-[3] h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
      </div>
    </div>
  );
}

function AgendaDayCards({
  groups,
  loading,
  emptyLabel,
}: {
  groups: CalendarDayGroup[];
  loading: boolean;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <div
        className="rounded-2xl border py-6 text-center text-sm"
        style={{
          backgroundColor: CSP_SURFACE,
          borderColor: "rgba(248, 250, 252, 0.08)",
          color: CSP_TEXT_SECONDARY,
        }}
      >
        Loading events...
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <div
        className="rounded-2xl border py-6 text-center text-sm"
        style={{
          backgroundColor: CSP_SURFACE,
          borderColor: "rgba(248, 250, 252, 0.08)",
          color: CSP_TEXT_SECONDARY,
        }}
      >
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 relative z-[1] pointer-events-auto">
      {groups.map((group) => (
        <div
          key={group.dayKey}
          className="rounded-2xl border"
          style={{
            backgroundColor: CSP_SURFACE,
            borderColor: "rgba(248, 250, 252, 0.08)",
            padding: CSP_CARD_PADDING,
          }}
        >
          <p className="text-sm font-semibold mb-3">{group.label}</p>
          <div className="space-y-2">
            {group.events.map((event, index) => {
              const start = new Date(event.start_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });
              const end = new Date(event.end_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });

              if (event.type === "booking") {
                return (
                  <div
                    key={`${event.booking_id ?? "booking"}-${index}`}
                    className="rounded-xl border px-3 py-2"
                    style={{
                      borderColor: "rgba(248, 250, 252, 0.08)",
                      backgroundColor: CSP_INPUT,
                    }}
                  >
                    <p className="text-sm font-medium">{event.service_type ?? "Booking"}</p>
                    <p className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                      {event.status ?? "scheduled"} · {start} - {end}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: CSP_TEXT_SECONDARY }}>
                      {formatCurrency(event.price_cents)}
                    </p>
                  </div>
                );
              }

              const eventTitle = event.type === "time_off" ? "Time off" : "Blocked";
              const reason = event.reason ?? event.status ?? "No reason provided";

              return (
                <div
                  key={`${event.type}-${event.time_off_id ?? event.manual_block_id ?? index}`}
                  className="rounded-xl border px-3 py-2"
                  style={{
                    borderColor: "rgba(248, 250, 252, 0.08)",
                    backgroundColor: CSP_INPUT,
                  }}
                >
                  <p className="text-sm font-medium">{eventTitle}</p>
                  <p className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                    {start} - {end}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: CSP_TEXT_SECONDARY }}>
                    {reason}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CalendarScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: CalendarTab =
    tabParam === "availability" ? "availability" : tabParam === "month" ? "month" : "agenda";
  const [activeTab, setActiveTab] = useState<CalendarTab>(initialTab);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [providerId, setProviderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [events, setEvents] = useState<ProviderCalendarEvent[]>([]);
  const [rangePreset, setRangePreset] = useState<RangePreset>("30d");
  const [flags, setFlags] = useState<PlatformFlags>({
    calendar_enabled: true,
    insights_enabled: true,
  });
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>([]);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<Snap>("medium");
  const [savingBlock, setSavingBlock] = useState(false);
  const [savingTimeOff, setSavingTimeOff] = useState(false);

  const [blockForm, setBlockForm] = useState({
    start_at: toLocalDateTimeInput(new Date()),
    end_at: toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)),
    reason: "",
  });
  const [timeOffForm, setTimeOffForm] = useState({
    start_at: toLocalDateTimeInput(new Date()),
    end_at: toLocalDateTimeInput(new Date(Date.now() + 2 * 60 * 60 * 1000)),
    reason: "",
  });

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "availability") setActiveTab("availability");
    else if (tab === "month") setActiveTab("month");
    else setActiveTab("agenda");
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      if (!user?.id) {
        setLoading(false);
        setError("You must be signed in to manage your calendar.");
        return;
      }

      setProviderId(user.id);
      await Promise.all([loadFlags(), loadEvents(user.id, "30d"), loadAvailability(user.id)]);
      if (!mounted) return;
      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!providerId || !flags.calendar_enabled) return;
    if (activeTab !== "agenda" && activeTab !== "month") return;
    void loadEvents(providerId, rangePreset);
  }, [providerId, activeTab, flags.calendar_enabled, rangePreset]);

  const groupedAgenda = useMemo(() => groupCalendarDayGroups(events), [events]);

  const groupedMonthAgenda = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    const inMonth = events.filter((e) => {
      const d = new Date(e.start_at);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === y && d.getMonth() === m;
    });
    return groupCalendarDayGroups(inMonth);
  }, [events, viewMonth]);

  async function loadFlags() {
    const { data, error: flagsError } = await supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["calendar_enabled", "insights_enabled"]);

    if (flagsError || !data) {
      setFlags({ calendar_enabled: true, insights_enabled: true });
      return;
    }

    const byKey = data.reduce<Record<string, string>>((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    setFlags({
      calendar_enabled: parsePlatformFlag(byKey.calendar_enabled, true),
      insights_enabled: parsePlatformFlag(byKey.insights_enabled, true),
    });
  }

  async function loadEvents(currentProviderId: string, preset: RangePreset = "30d") {
    try {
      const { startISO, endISO } = getDateRange(preset);
      const rows = await getProviderCalendarEvents(currentProviderId, startISO, endISO);
      setEvents(rows);
    } catch (eventsError) {
      const message = eventsError instanceof Error ? eventsError.message : "Unable to load calendar events.";
      setError(message);
      setEvents([]);
    }
  }

  async function loadAvailability(currentProviderId: string) {
    const { data, error: availabilityError } = await supabase
      .from("provider_availability_blocks")
      .select("id, day_of_week, start_time, end_time, timezone, active")
      .eq("provider_id", currentProviderId)
      .order("day_of_week", { ascending: true });

    if (availabilityError) {
      setError(availabilityError.message);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setAvailabilityRows(
        DAY_ROWS.map((day) => ({
          id: null,
          day_of_week: day.day_of_week,
          day_label: day.day_label,
          active: false,
          start_time: "09:00",
          end_time: "17:00",
          timezone,
        }))
      );
      return;
    }

    const firstPerDay = new Map<number, (typeof data)[number]>();
    for (const row of data ?? []) {
      if (!firstPerDay.has(row.day_of_week)) {
        firstPerDay.set(row.day_of_week, row);
      }
    }

    const defaultTimezone =
      firstPerDay.get(1)?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";

    setAvailabilityRows(
      DAY_ROWS.map((day) => {
        const row = firstPerDay.get(day.day_of_week);
        return {
          id: row?.id ?? null,
          day_of_week: day.day_of_week,
          day_label: day.day_label,
          active: row?.active ?? false,
          start_time: row?.start_time ?? "09:00:00",
          end_time: row?.end_time ?? "17:00:00",
          timezone: row?.timezone ?? defaultTimezone,
        };
      })
    );
  }

  function setAvailabilityValue(dayOfWeek: number, patch: Partial<AvailabilityRow>) {
    setAvailabilityRows((prev) =>
      prev.map((row) => (row.day_of_week === dayOfWeek ? { ...row, ...patch } : row))
    );
  }

  async function handleSaveAvailability() {
    if (!providerId) return;
    setSavingAvailability(true);
    setError(null);

    try {
      for (const row of availabilityRows) {
        const payload = {
          provider_id: providerId,
          day_of_week: row.day_of_week,
          start_time: row.start_time.length === 5 ? `${row.start_time}:00` : row.start_time,
          end_time: row.end_time.length === 5 ? `${row.end_time}:00` : row.end_time,
          timezone: row.timezone,
          active: row.active,
        };

        if (row.id) {
          const { error: updateError } = await supabase
            .from("provider_availability_blocks")
            .update(payload)
            .eq("id", row.id)
            .eq("provider_id", providerId);
          if (updateError) throw updateError;
        } else if (row.active) {
          const { error: insertError } = await supabase.from("provider_availability_blocks").insert(payload);
          if (insertError) throw insertError;
        }
      }

      await loadAvailability(providerId);
      setToast("Weekly availability updated");
      window.setTimeout(() => setToast(null), 2200);
    } catch (availabilitySaveError) {
      const message =
        availabilitySaveError instanceof Error
          ? availabilitySaveError.message
          : "Unable to update weekly availability.";
      setError(message);
    } finally {
      setSavingAvailability(false);
    }
  }

  async function handleCreateBlockTime() {
    if (!providerId) return;
    const start = new Date(blockForm.start_at);
    const end = new Date(blockForm.end_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError("Block time must have a valid start and end.");
      return;
    }

    setSavingBlock(true);
    setError(null);
    const { error: insertError } = await supabase.from("provider_manual_blocks").insert({
      provider_id: providerId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      reason: blockForm.reason.trim() || null,
    });
    setSavingBlock(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setBlockOpen(false);
    setBlockForm({
      start_at: toLocalDateTimeInput(new Date()),
      end_at: toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)),
      reason: "",
    });
    await loadEvents(providerId, rangePreset);
    setToast("Block time added");
    window.setTimeout(() => setToast(null), 2200);
  }

  async function handleCreateTimeOff() {
    if (!providerId) return;
    const start = new Date(timeOffForm.start_at);
    const end = new Date(timeOffForm.end_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      setError("Time off must have a valid start and end.");
      return;
    }

    setSavingTimeOff(true);
    setError(null);
    const { error: insertError } = await supabase.from("provider_time_off").insert({
      provider_id: providerId,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      reason: timeOffForm.reason.trim() || null,
    });
    setSavingTimeOff(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTimeOffOpen(false);
    setTimeOffForm({
      start_at: toLocalDateTimeInput(new Date()),
      end_at: toLocalDateTimeInput(new Date(Date.now() + 2 * 60 * 60 * 1000)),
      reason: "",
    });
    await loadEvents(providerId, rangePreset);
    setToast("Time off added");
    window.setTimeout(() => setToast(null), 2200);
  }

  return (
    <div className="relative z-0 isolate pointer-events-auto" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Manage weekly availability, time off, and blocked slots.
        </p>
      </header>

      {toast ? (
        <div
          className="mb-4 rounded-xl border px-3 py-2 text-sm"
          style={{
            backgroundColor: "rgba(141, 204, 100, 0.12)",
            borderColor: "rgba(141, 204, 100, 0.4)",
            color: CSP_TEXT_PRIMARY,
          }}
        >
          {toast}
        </div>
      ) : null}

      {error ? (
        <div
          className="mb-4 rounded-xl border px-3 py-2 text-sm"
          style={{
            backgroundColor: "rgba(239, 68, 68, 0.12)",
            borderColor: "rgba(239, 68, 68, 0.4)",
            color: CSP_TEXT_PRIMARY,
          }}
        >
          {error}
        </div>
      ) : null}

      <section className="relative z-[5]" style={{ marginBottom: CSP_SECTION_GAP, pointerEvents: "auto" }}>
        <div
          className="rounded-2xl border p-1 flex gap-1"
          style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248, 250, 252, 0.08)" }}
        >
          <button
            type="button"
            className="flex-1 min-h-[44px] rounded-xl py-2.5 text-sm font-medium relative z-[1] pointer-events-auto touch-manipulation"
            onClick={() => {
              setActiveTab("agenda");
              setSearchParams({});
            }}
            style={{
              backgroundColor: activeTab === "agenda" ? CSP_INPUT : "transparent",
              color: activeTab === "agenda" ? CSP_TEXT_PRIMARY : CSP_TEXT_SECONDARY,
            }}
          >
            Agenda
          </button>
          <button
            type="button"
            className="flex-1 min-h-[44px] rounded-xl py-2.5 text-sm font-medium relative z-[1] pointer-events-auto touch-manipulation"
            onClick={() => {
              setActiveTab("availability");
              setSearchParams({ tab: "availability" });
            }}
            style={{
              backgroundColor: activeTab === "availability" ? CSP_INPUT : "transparent",
              color: activeTab === "availability" ? CSP_TEXT_PRIMARY : CSP_TEXT_SECONDARY,
            }}
          >
            Availability
          </button>
          <button
            type="button"
            className="flex-1 min-h-[44px] rounded-xl py-2.5 text-sm font-medium relative z-[1] pointer-events-auto touch-manipulation"
            onClick={() => {
              setActiveTab("month");
              setSearchParams({ tab: "month" });
            }}
            style={{
              backgroundColor: activeTab === "month" ? CSP_INPUT : "transparent",
              color: activeTab === "month" ? CSP_TEXT_PRIMARY : CSP_TEXT_SECONDARY,
            }}
          >
            Month
          </button>
        </div>
      </section>

      {!flags.calendar_enabled ? (
        <section style={{ marginBottom: CSP_SECTION_GAP }}>
          <div
            className="rounded-2xl border"
            style={{
              backgroundColor: CSP_SURFACE,
              padding: CSP_CARD_PADDING,
              borderColor: "rgba(248, 250, 252, 0.08)",
            }}
          >
            <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
              Calendar is currently disabled by platform settings.
            </p>
          </div>
        </section>
      ) : null}

      {activeTab === "agenda" && flags.calendar_enabled ? (
        <>
          <section style={{ marginBottom: CSP_SECTION_GAP }}>
            <h2 className="text-sm font-medium mb-3" style={{ color: CSP_TEXT_SECONDARY }}>
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSheetSnap("medium");
                  setBlockOpen(true);
                }}
                className="w-full py-3 rounded-xl font-medium text-sm transition-opacity hover:opacity-90 active:opacity-85"
                style={{
                  backgroundColor: CSP_INPUT,
                  color: CSP_TEXT_PRIMARY,
                  border: "1px solid rgba(248, 250, 252, 0.08)",
                }}
              >
                Block time
              </button>
              <button
                type="button"
                onClick={() => {
                  setSheetSnap("medium");
                  setTimeOffOpen(true);
                }}
                className="w-full py-3 rounded-xl font-medium text-sm transition-opacity hover:opacity-90 active:opacity-85"
                style={{
                  backgroundColor: CSP_INPUT,
                  color: CSP_TEXT_PRIMARY,
                  border: "1px solid rgba(248, 250, 252, 0.08)",
                }}
              >
                Add time off
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("availability");
                  setSearchParams({ tab: "availability" });
                }}
                className="w-full py-3 rounded-xl font-medium text-sm transition-opacity hover:opacity-90 active:opacity-85"
                style={{
                  backgroundColor: CSP_INPUT,
                  color: CSP_TEXT_PRIMARY,
                  border: "1px solid rgba(248, 250, 252, 0.08)",
                }}
              >
                Edit weekly availability
              </button>
            </div>
          </section>

          <section className="relative z-[4]" style={{ marginBottom: CSP_SECTION_GAP, pointerEvents: "auto" }}>
            <h2 className="text-sm font-medium mb-3" style={{ color: CSP_TEXT_SECONDARY }}>
              Agenda
            </h2>
            <div className="mb-3 flex flex-wrap gap-2 relative z-[5]">
              {[
                { id: "today", label: "Today" },
                { id: "7d", label: "7 days" },
                { id: "30d", label: "30 days" },
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setRangePreset(preset.id as RangePreset)}
                  className="rounded-lg px-3 py-2.5 min-h-[44px] text-xs font-medium transition-opacity hover:opacity-90 active:opacity-85 relative z-[1] pointer-events-auto touch-manipulation"
                  style={{
                    backgroundColor: rangePreset === preset.id ? CSP_INPUT : "transparent",
                    color: rangePreset === preset.id ? CSP_TEXT_PRIMARY : CSP_TEXT_SECONDARY,
                    border: "1px solid rgba(248, 250, 252, 0.12)",
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <AgendaDayCards
              groups={groupedAgenda}
              loading={loading}
              emptyLabel="No events in this window."
            />
          </section>
        </>
      ) : null}

      {activeTab === "month" && flags.calendar_enabled ? (
        <section className="relative z-[4]" style={{ marginBottom: CSP_SECTION_GAP, pointerEvents: "auto" }}>
          <h2 className="text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>
            Month list
          </h2>
          <p className="text-xs mt-1 mb-3 leading-relaxed" style={{ color: CSP_TEXT_SECONDARY }}>
            Jobs and calendar blocks for one month at a time, grouped by day. This is a{" "}
            <span className="font-medium text-white/80">list view</span>, not a full calendar grid. Data comes from
            the same loaded window as the range chips below (wider range = more days available).
          </p>
          <div className="mb-3 flex flex-wrap gap-2 relative z-[5]">
            {[
              { id: "today", label: "Today" },
              { id: "7d", label: "7 days" },
              { id: "30d", label: "30 days" },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setRangePreset(preset.id as RangePreset)}
                className="rounded-lg px-3 py-2.5 min-h-[44px] text-xs font-medium transition-opacity hover:opacity-90 active:opacity-85 relative z-[1] pointer-events-auto touch-manipulation"
                style={{
                  backgroundColor: rangePreset === preset.id ? CSP_INPUT : "transparent",
                  color: rangePreset === preset.id ? CSP_TEXT_PRIMARY : CSP_TEXT_SECONDARY,
                  border: "1px solid rgba(248, 250, 252, 0.12)",
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] uppercase tracking-wide mb-2 font-medium" style={{ color: CSP_TEXT_SECONDARY }}>
            Selected month
          </p>
          <div
            className="mb-4 flex items-center justify-between gap-2 rounded-2xl border p-1 relative z-[6]"
            style={{
              backgroundColor: CSP_SURFACE,
              borderColor: "rgba(248, 250, 252, 0.08)",
              pointerEvents: "auto",
            }}
          >
            <button
              type="button"
              aria-label="Previous month"
              className="shrink-0 min-h-[44px] min-w-[44px] rounded-xl text-lg font-semibold relative z-[6] pointer-events-auto touch-manipulation"
              style={{ backgroundColor: CSP_INPUT, color: CSP_TEXT_PRIMARY }}
              onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <h3
              className="text-base font-semibold text-center flex-1 px-2 min-h-[44px] flex items-center justify-center"
              style={{ color: CSP_TEXT_PRIMARY }}
            >
              {viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </h3>
            <button
              type="button"
              aria-label="Next month"
              className="shrink-0 min-h-[44px] min-w-[44px] rounded-xl text-lg font-semibold relative z-[6] pointer-events-auto touch-manipulation"
              style={{ backgroundColor: CSP_INPUT, color: CSP_TEXT_PRIMARY }}
              onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>
          <p className="text-[11px] uppercase tracking-wide mb-2 font-medium" style={{ color: CSP_TEXT_SECONDARY }}>
            Jobs & blocks this month
          </p>
          <AgendaDayCards
            groups={groupedMonthAgenda}
            loading={loading}
            emptyLabel="No jobs this month."
          />
        </section>
      ) : null}

      {activeTab === "availability" ? (
        <section className="relative z-[4]" style={{ marginBottom: CSP_SECTION_GAP, pointerEvents: "auto" }}>
          <h2 className="text-sm font-medium mb-3" style={{ color: CSP_TEXT_SECONDARY }}>
            Weekly Availability
          </h2>
          <div className="flex flex-col gap-3 w-full max-w-full min-w-0">
            {availabilityRows.map((row) => {
              const startId = `csp-avail-start-${row.day_of_week}`;
              const endId = `csp-avail-end-${row.day_of_week}`;
              const tzId = `csp-avail-tz-${row.day_of_week}`;
              const dayHeadingId = `csp-avail-day-${row.day_of_week}`;
              return (
                <div
                  key={row.day_of_week}
                  className="w-full max-w-full min-w-0 overflow-hidden rounded-2xl border relative z-[1] box-border"
                  style={{
                    backgroundColor: CSP_SURFACE,
                    padding: "14px 14px 12px",
                    borderColor: "rgba(248, 250, 252, 0.1)",
                    pointerEvents: "auto",
                  }}
                >
                  <div className="flex items-center justify-between gap-3 min-w-0">
                    <span
                      id={dayHeadingId}
                      className="text-sm font-semibold tracking-tight truncate min-w-0"
                      style={{ color: CSP_TEXT_PRIMARY }}
                    >
                      {row.day_label}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: CSP_TEXT_SECONDARY }}>
                        Active
                      </span>
                      <label className="relative inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          role="switch"
                          className="peer sr-only"
                          checked={row.active}
                          aria-checked={row.active}
                          aria-labelledby={dayHeadingId}
                          aria-label={`Available ${row.day_label}`}
                          onChange={(e) => setAvailabilityValue(row.day_of_week, { active: e.target.checked })}
                        />
                        <span
                          className="pointer-events-none absolute inset-0 rounded-full border border-white/10 bg-slate-800/90 transition-colors duration-200 peer-checked:bg-blue-600/80 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/55"
                          aria-hidden
                        />
                        <span
                          className="pointer-events-none absolute left-[3px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200 ease-out peer-checked:translate-x-[26px]"
                          aria-hidden
                        />
                      </label>
                    </div>
                  </div>

                  {row.active ? (
                    <>
                      <p className="text-[11px] mt-2.5 font-medium" style={{ color: "rgba(148, 163, 184, 0.9)" }}>
                        Available hours
                      </p>
                      <div className="mt-2 grid w-full min-w-0 max-w-full grid-cols-2 gap-3 box-border">
                        <AvailTimeSelect
                          id={startId}
                          label="Start"
                          value={row.start_time}
                          onChange={(v) => setAvailabilityValue(row.day_of_week, { start_time: v })}
                        />
                        <AvailTimeSelect
                          id={endId}
                          label="End"
                          value={row.end_time}
                          onChange={(v) => setAvailabilityValue(row.day_of_week, { end_time: v })}
                        />
                      </div>
                    </>
                  ) : (
                    <p
                      className="mt-3 text-xs font-medium rounded-xl border border-white/5 px-3 py-2.5"
                      style={{ color: "rgba(148, 163, 184, 0.85)", backgroundColor: "rgba(15, 23, 42, 0.35)" }}
                    >
                      Unavailable — turn on Active to set hours.
                    </p>
                  )}

                  <div className="mt-3 pt-2.5 border-t border-white/[0.06] relative z-[2] min-w-0">
                    <label
                      htmlFor={tzId}
                      className="block text-[10px] font-medium uppercase tracking-wide mb-1"
                      style={{ color: "rgba(100, 116, 139, 0.95)" }}
                    >
                      Timezone
                    </label>
                    <input
                      id={tzId}
                      type="text"
                      value={row.timezone}
                      onChange={(e) => setAvailabilityValue(row.day_of_week, { timezone: e.target.value })}
                      className="w-full min-w-0 max-w-full box-border rounded-xl border border-white/[0.08] bg-slate-950/40 px-3 py-2 text-xs text-white/80 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 relative z-[2] pointer-events-auto touch-manipulation"
                      placeholder="e.g. America/New_York"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void handleSaveAvailability()}
            disabled={savingAvailability}
            className="w-full mt-4 py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 active:opacity-85 disabled:opacity-50"
            style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          >
            {savingAvailability ? "Saving..." : "Save Weekly Availability"}
          </button>
        </section>
      ) : null}

      {!flags.insights_enabled ? (
        <p className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
          Insights are currently disabled by platform settings.
        </p>
      ) : null}

      <BottomSheet
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        snap={sheetSnap}
        setSnap={setSheetSnap}
        title="Block time"
        subtitle="Create a manual block in your schedule."
        tone="dark"
      >
        <div className="space-y-4 px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
          <div>
            <label className="block text-xs mb-1" style={{ color: CSP_TEXT_SECONDARY }}>
              Start
            </label>
            <input
              type="datetime-local"
              value={blockForm.start_at}
              onChange={(e) => setBlockForm((prev) => ({ ...prev, start_at: e.target.value }))}
              className="w-full min-h-[48px] rounded-xl border border-white/10 text-base text-white focus:outline-none focus:ring-2 focus:ring-white/30 relative z-[2] pointer-events-auto touch-manipulation px-3"
              style={{ backgroundColor: CSP_INPUT, colorScheme: "dark" }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: CSP_TEXT_SECONDARY }}>
              End
            </label>
            <input
              type="datetime-local"
              value={blockForm.end_at}
              onChange={(e) => setBlockForm((prev) => ({ ...prev, end_at: e.target.value }))}
              className="w-full min-h-[48px] rounded-xl border border-white/10 text-base text-white focus:outline-none focus:ring-2 focus:ring-white/30 relative z-[2] pointer-events-auto touch-manipulation px-3"
              style={{ backgroundColor: CSP_INPUT, colorScheme: "dark" }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: CSP_TEXT_SECONDARY }}>
              Reason (optional)
            </label>
            <input
              type="text"
              value={blockForm.reason}
              onChange={(e) => setBlockForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Unavailable"
              className="w-full rounded-xl border-0 text-white placeholder:opacity-60 focus:ring-2 focus:ring-offset-0 focus:ring-white/30"
              style={{ backgroundColor: CSP_INPUT, padding: "12px 14px" }}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleCreateBlockTime()}
            disabled={savingBlock}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 active:opacity-85 disabled:opacity-50"
            style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          >
            {savingBlock ? "Saving..." : "Save block"}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={timeOffOpen}
        onClose={() => setTimeOffOpen(false)}
        snap={sheetSnap}
        setSnap={setSheetSnap}
        title="Add time off"
        subtitle="Create a time-off window in your schedule."
        tone="dark"
      >
        <div className="space-y-4 px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))]">
          <div>
            <label className="block text-xs mb-1" style={{ color: CSP_TEXT_SECONDARY }}>
              Start
            </label>
            <input
              type="datetime-local"
              value={timeOffForm.start_at}
              onChange={(e) => setTimeOffForm((prev) => ({ ...prev, start_at: e.target.value }))}
              className="w-full min-h-[48px] rounded-xl border border-white/10 text-base text-white focus:outline-none focus:ring-2 focus:ring-white/30 relative z-[2] pointer-events-auto touch-manipulation px-3"
              style={{ backgroundColor: CSP_INPUT, colorScheme: "dark" }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: CSP_TEXT_SECONDARY }}>
              End
            </label>
            <input
              type="datetime-local"
              value={timeOffForm.end_at}
              onChange={(e) => setTimeOffForm((prev) => ({ ...prev, end_at: e.target.value }))}
              className="w-full min-h-[48px] rounded-xl border border-white/10 text-base text-white focus:outline-none focus:ring-2 focus:ring-white/30 relative z-[2] pointer-events-auto touch-manipulation px-3"
              style={{ backgroundColor: CSP_INPUT, colorScheme: "dark" }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: CSP_TEXT_SECONDARY }}>
              Reason (optional)
            </label>
            <input
              type="text"
              value={timeOffForm.reason}
              onChange={(e) => setTimeOffForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Out of office"
              className="w-full rounded-xl border-0 text-white placeholder:opacity-60 focus:ring-2 focus:ring-offset-0 focus:ring-white/30"
              style={{ backgroundColor: CSP_INPUT, padding: "12px 14px" }}
            />
          </div>
          <button
            type="button"
            onClick={() => void handleCreateTimeOff()}
            disabled={savingTimeOff}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 active:opacity-85 disabled:opacity-50"
            style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          >
            {savingTimeOff ? "Saving..." : "Save time off"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
