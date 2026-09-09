import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Clock3, CalendarDays, SlidersHorizontal } from "lucide-react";
import BottomSheet, { type Snap } from "../../../components/ui/BottomSheet";
import { getProviderCalendarEvents, type ProviderCalendarEvent } from "../../../api/providerCalendar";
import { supabase } from "../../../lib/supabase";
import {
  CSP_INPUT,
  CSP_PRIMARY_BUTTON,
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

const DAY_ROWS = [
  { day_of_week: 0, day_label: "Sunday" },
  { day_of_week: 1, day_label: "Monday" },
  { day_of_week: 2, day_label: "Tuesday" },
  { day_of_week: 3, day_label: "Wednesday" },
  { day_of_week: 4, day_label: "Thursday" },
  { day_of_week: 5, day_label: "Friday" },
  { day_of_week: 6, day_label: "Saturday" },
];

const AVAIL_TIME_OPTIONS: string[] = (() => {
  const pad = (n: number) => String(n).padStart(2, "0");
  const out: string[] = [];
  for (let h = 6; h <= 21; h += 1) {
    out.push(`${pad(h)}:00`);
    out.push(`${pad(h)}:30`);
  }
  out.push("22:00");
  return out;
})();

function parsePlatformFlag(value: string | null | undefined, fallback: boolean) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

function formatCurrency(cents: number | null) {
  if (typeof cents !== "number") return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function toLocalDateTimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getDateRange(preset: RangePreset) {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setDate(end.getDate() + (preset === "today" ? 0 : preset === "7d" ? 6 : 29));
  end.setHours(23, 59, 59, 999);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function clampTimeToOptions(raw: string) {
  const t = raw.length >= 5 ? raw.slice(0, 5) : "09:00";
  if (AVAIL_TIME_OPTIONS.includes(t)) return t;
  return "09:00";
}

function formatTimeOptionLabel(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function groupCalendarDayGroups(eventSource: ProviderCalendarEvent[]) {
  const grouped = new Map<string, ProviderCalendarEvent[]>();
  const sorted = [...eventSource].sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  for (const event of sorted) {
    const key = event.start_at.slice(0, 10);
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }
  return Array.from(grouped.entries()).map(([dayKey, events]) => ({
    dayKey,
    label: new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
    events,
  }));
}

function AvailTimeSelect({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: CSP_TEXT_SECONDARY }}>
      {label}
      <span className="relative mt-1 block">
        <select
          id={id}
          value={clampTimeToOptions(value)}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-3 pr-9 text-sm font-medium text-white outline-none"
        >
          {AVAIL_TIME_OPTIONS.map((option) => <option key={option} value={option}>{formatTimeOptionLabel(option)}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
      </span>
    </label>
  );
}

function AgendaList({ events, loading, emptyLabel }: { events: ProviderCalendarEvent[]; loading: boolean; emptyLabel: string }) {
  const groups = useMemo(() => groupCalendarDayGroups(events), [events]);

  if (loading) {
    return <div className="border-y border-white/10 py-7 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading schedule…</div>;
  }

  if (groups.length === 0) {
    return (
      <div className="border-y border-white/10 py-7">
        <p className="text-sm font-semibold">{emptyLabel}</p>
        <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
          Your bookings, time off, and blocked time will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/10 border-y border-white/10">
      {groups.map((group) => (
        <section key={group.dayKey} className="py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: CSP_TEXT_SECONDARY }}>{group.label}</p>
          <div className="space-y-3">
            {group.events.map((event, index) => {
              const start = new Date(event.start_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
              const end = new Date(event.end_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
              const isBooking = event.type === "booking";
              return (
                <div key={`${event.booking_id ?? event.time_off_id ?? event.manual_block_id ?? index}`} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{isBooking ? event.service_type ?? "Cleaning" : event.type === "time_off" ? "Time off" : "Blocked"}</p>
                    <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{start}–{end}{isBooking && event.status ? ` · ${event.status}` : ""}</p>
                    {!isBooking && event.reason ? <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{event.reason}</p> : null}
                  </div>
                  {isBooking ? <p className="shrink-0 text-sm font-semibold">{formatCurrency(event.price_cents)}</p> : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function CalendarScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get("tab");
  const initialTab: CalendarTab = param === "availability" ? "availability" : param === "month" ? "month" : "agenda";
  const [activeTab, setActiveTab] = useState<CalendarTab>(initialTab);
  const [viewMonth, setViewMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [providerId, setProviderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [events, setEvents] = useState<ProviderCalendarEvent[]>([]);
  const [rangePreset, setRangePreset] = useState<RangePreset>("30d");
  const [flags, setFlags] = useState<PlatformFlags>({ calendar_enabled: true, insights_enabled: true });
  const [availabilityRows, setAvailabilityRows] = useState<AvailabilityRow[]>([]);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<Snap>("medium");
  const [savingBlock, setSavingBlock] = useState(false);
  const [savingTimeOff, setSavingTimeOff] = useState(false);
  const [blockForm, setBlockForm] = useState({ start_at: toLocalDateTimeInput(new Date()), end_at: toLocalDateTimeInput(new Date(Date.now() + 3600000)), reason: "" });
  const [timeOffForm, setTimeOffForm] = useState({ start_at: toLocalDateTimeInput(new Date()), end_at: toLocalDateTimeInput(new Date(Date.now() + 7200000)), reason: "" });

  useEffect(() => {
    const tab = searchParams.get("tab");
    setActiveTab(tab === "availability" ? "availability" : tab === "month" ? "month" : "agenda");
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!user?.id) {
        setLoading(false);
        setError("You must be signed in to manage your calendar.");
        return;
      }
      setProviderId(user.id);
      await Promise.all([loadFlags(), loadEvents(user.id, "30d"), loadAvailability(user.id)]);
      if (mounted) setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!providerId || !flags.calendar_enabled || activeTab === "availability") return;
    void loadEvents(providerId, rangePreset);
  }, [providerId, activeTab, flags.calendar_enabled, rangePreset]);

  async function loadFlags() {
    const { data } = await supabase.from("platform_settings").select("key, value").in("key", ["calendar_enabled", "insights_enabled"]);
    const byKey = (data ?? []).reduce<Record<string, string>>((acc, row) => { acc[row.key] = row.value; return acc; }, {});
    setFlags({
      calendar_enabled: parsePlatformFlag(byKey.calendar_enabled, true),
      insights_enabled: parsePlatformFlag(byKey.insights_enabled, true),
    });
  }

  async function loadEvents(currentProviderId: string, preset: RangePreset) {
    try {
      const { startISO, endISO } = getDateRange(preset);
      setEvents(await getProviderCalendarEvents(currentProviderId, startISO, endISO));
    } catch (err) {
      setEvents([]);
      setError(err instanceof Error ? err.message : "Unable to load calendar events.");
    }
  }

  async function loadAvailability(currentProviderId: string) {
    const { data, error: availabilityError } = await supabase
      .from("provider_availability_blocks")
      .select("id, day_of_week, start_time, end_time, timezone, active")
      .eq("provider_id", currentProviderId)
      .order("day_of_week", { ascending: true });

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
    if (availabilityError) {
      setAvailabilityRows(DAY_ROWS.map((day) => ({ id: null, ...day, active: false, start_time: "09:00", end_time: "17:00", timezone })));
      return;
    }

    const firstPerDay = new Map<number, (typeof data)[number]>();
    for (const row of data ?? []) if (!firstPerDay.has(row.day_of_week)) firstPerDay.set(row.day_of_week, row);
    setAvailabilityRows(DAY_ROWS.map((day) => {
      const row = firstPerDay.get(day.day_of_week);
      return {
        id: row?.id ?? null,
        ...day,
        active: row?.active ?? false,
        start_time: row?.start_time ?? "09:00",
        end_time: row?.end_time ?? "17:00",
        timezone: row?.timezone ?? timezone,
      };
    }));
  }

  function setAvailabilityValue(dayOfWeek: number, patch: Partial<AvailabilityRow>) {
    setAvailabilityRows((prev) => prev.map((row) => row.day_of_week === dayOfWeek ? { ...row, ...patch } : row));
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
          const { error: updateError } = await supabase.from("provider_availability_blocks").update(payload).eq("id", row.id).eq("provider_id", providerId);
          if (updateError) throw updateError;
        } else if (row.active) {
          const { error: insertError } = await supabase.from("provider_availability_blocks").insert(payload);
          if (insertError) throw insertError;
        }
      }
      await loadAvailability(providerId);
      setToast("Weekly availability updated");
      window.setTimeout(() => setToast(null), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update weekly availability.");
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
    const { error: insertError } = await supabase.from("provider_manual_blocks").insert({ provider_id: providerId, start_at: start.toISOString(), end_at: end.toISOString(), reason: blockForm.reason.trim() || null });
    setSavingBlock(false);
    if (insertError) { setError(insertError.message); return; }
    setBlockOpen(false);
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
    const { error: insertError } = await supabase.from("provider_time_off").insert({ provider_id: providerId, start_at: start.toISOString(), end_at: end.toISOString(), reason: timeOffForm.reason.trim() || null });
    setSavingTimeOff(false);
    if (insertError) { setError(insertError.message); return; }
    setTimeOffOpen(false);
    await loadEvents(providerId, rangePreset);
    setToast("Time off added");
    window.setTimeout(() => setToast(null), 2200);
  }

  const monthEvents = useMemo(() => events.filter((event) => {
    const d = new Date(event.start_at);
    return d.getFullYear() === viewMonth.getFullYear() && d.getMonth() === viewMonth.getMonth();
  }), [events, viewMonth]);

  return (
    <div className="relative z-0 isolate pb-4" style={{ color: CSP_TEXT_PRIMARY }}>
      <header className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-[-0.025em]">Calendar</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          Your schedule first. Availability controls stay close when you need them.
        </p>
      </header>

      {toast ? <div className="mb-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm">{toast}</div> : null}
      {error ? <div className="mb-4 rounded-xl border border-red-400/20 bg-red-950/20 px-3 py-2 text-sm">{error}</div> : null}

      <div className="mb-6 flex gap-6 border-b border-white/10">
        {(["agenda", "availability", "month"] as CalendarTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setSearchParams(tab === "agenda" ? {} : { tab });
            }}
            className="relative min-h-11 pb-3 text-sm font-semibold capitalize"
            style={{ color: activeTab === tab ? CSP_TEXT_PRIMARY : CSP_TEXT_SECONDARY }}
          >
            {tab}
            {activeTab === tab ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full" style={{ backgroundColor: CSP_PRIMARY_BUTTON }} /> : null}
          </button>
        ))}
      </div>

      {!flags.calendar_enabled ? <p className="border-y border-white/10 py-6 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Calendar is currently unavailable.</p> : null}

      {activeTab === "agenda" && flags.calendar_enabled ? (
        <>
          <section className="mb-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Your schedule</p>
                <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Bookings, blocks, and time off.</p>
              </div>
              <div className="flex gap-1 rounded-xl border border-white/10 p-1">
                {(["today", "7d", "30d"] as RangePreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRangePreset(preset)}
                    className="min-h-9 rounded-lg px-3 text-xs font-semibold"
                    style={{ backgroundColor: rangePreset === preset ? CSP_INPUT : "transparent", color: rangePreset === preset ? CSP_TEXT_PRIMARY : CSP_TEXT_SECONDARY }}
                  >
                    {preset === "today" ? "Today" : preset === "7d" ? "7 days" : "30 days"}
                  </button>
                ))}
              </div>
            </div>
            <AgendaList events={events} loading={loading} emptyLabel="Nothing scheduled in this window." />
          </section>

          <section className="mb-2">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: CSP_TEXT_SECONDARY }}>Manage schedule</p>
            <div className="divide-y divide-white/10 border-y border-white/10">
              <button type="button" onClick={() => { setSheetSnap("medium"); setBlockOpen(true); }} className="flex min-h-14 w-full items-center justify-between text-left text-sm font-semibold">
                <span className="flex items-center gap-3"><Clock3 className="h-4 w-4" /> Block time</span><span style={{ color: CSP_TEXT_SECONDARY }}>→</span>
              </button>
              <button type="button" onClick={() => { setSheetSnap("medium"); setTimeOffOpen(true); }} className="flex min-h-14 w-full items-center justify-between text-left text-sm font-semibold">
                <span className="flex items-center gap-3"><CalendarDays className="h-4 w-4" /> Add time off</span><span style={{ color: CSP_TEXT_SECONDARY }}>→</span>
              </button>
              <button type="button" onClick={() => { setActiveTab("availability"); setSearchParams({ tab: "availability" }); }} className="flex min-h-14 w-full items-center justify-between text-left text-sm font-semibold">
                <span className="flex items-center gap-3"><SlidersHorizontal className="h-4 w-4" /> Weekly availability</span><span style={{ color: CSP_TEXT_SECONDARY }}>→</span>
              </button>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === "month" && flags.calendar_enabled ? (
        <section>
          <div className="mb-5 flex items-center justify-between border-y border-white/10 py-3">
            <button type="button" className="min-h-11 min-w-11 text-xl" onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>‹</button>
            <p className="text-base font-semibold">{viewMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
            <button type="button" className="min-h-11 min-w-11 text-xl" onClick={() => setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>›</button>
          </div>
          <AgendaList events={monthEvents} loading={loading} emptyLabel="No schedule items this month." />
        </section>
      ) : null}

      {activeTab === "availability" ? (
        <section>
          <div className="mb-5">
            <h2 className="text-lg font-semibold">Weekly availability</h2>
            <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Set the hours Cleanr can use when determining eligible work.</p>
          </div>

          <div className="divide-y divide-white/10 border-y border-white/10">
            {availabilityRows.map((row) => (
              <div key={row.day_of_week} className="py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold">{row.day_label}</p>
                    <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{row.active ? `${formatTimeOptionLabel(clampTimeToOptions(row.start_time))}–${formatTimeOptionLabel(clampTimeToOptions(row.end_time))}` : "Unavailable"}</p>
                  </div>
                  <label className="relative inline-flex h-7 w-12 cursor-pointer items-center">
                    <input type="checkbox" className="peer sr-only" checked={row.active} onChange={(e) => setAvailabilityValue(row.day_of_week, { active: e.target.checked })} />
                    <span className="absolute inset-0 rounded-full border border-white/10 bg-white/10 transition peer-checked:bg-blue-600" />
                    <span className="absolute left-1 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
                  </label>
                </div>
                {row.active ? (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <AvailTimeSelect id={`start-${row.day_of_week}`} label="Start" value={row.start_time} onChange={(value) => setAvailabilityValue(row.day_of_week, { start_time: value })} />
                    <AvailTimeSelect id={`end-${row.day_of_week}`} label="End" value={row.end_time} onChange={(value) => setAvailabilityValue(row.day_of_week, { end_time: value })} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <button type="button" onClick={() => void handleSaveAvailability()} disabled={savingAvailability} className="mt-5 w-full rounded-xl py-3.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
            {savingAvailability ? "Saving…" : "Save availability"}
          </button>
        </section>
      ) : null}

      <BottomSheet open={blockOpen} onClose={() => setBlockOpen(false)} snap={sheetSnap} setSnap={setSheetSnap} title="Block time" subtitle="Keep a period unavailable without changing your weekly hours." tone="dark">
        <div className="space-y-4 px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6">
          <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Start<input type="datetime-local" value={blockForm.start_at} onChange={(e) => setBlockForm((prev) => ({ ...prev, start_at: e.target.value }))} className="mt-1 min-h-12 w-full rounded-xl border border-white/10 px-3 text-white" style={{ backgroundColor: CSP_INPUT, colorScheme: "dark" }} /></label>
          <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>End<input type="datetime-local" value={blockForm.end_at} onChange={(e) => setBlockForm((prev) => ({ ...prev, end_at: e.target.value }))} className="mt-1 min-h-12 w-full rounded-xl border border-white/10 px-3 text-white" style={{ backgroundColor: CSP_INPUT, colorScheme: "dark" }} /></label>
          <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Reason (optional)<input type="text" value={blockForm.reason} onChange={(e) => setBlockForm((prev) => ({ ...prev, reason: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 px-3 py-3 text-white" style={{ backgroundColor: CSP_INPUT }} /></label>
          <button type="button" onClick={() => void handleCreateBlockTime()} disabled={savingBlock} className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>{savingBlock ? "Saving…" : "Save block"}</button>
        </div>
      </BottomSheet>

      <BottomSheet open={timeOffOpen} onClose={() => setTimeOffOpen(false)} snap={sheetSnap} setSnap={setSheetSnap} title="Add time off" subtitle="Protect time away from your normal availability." tone="dark">
        <div className="space-y-4 px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6">
          <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Start<input type="datetime-local" value={timeOffForm.start_at} onChange={(e) => setTimeOffForm((prev) => ({ ...prev, start_at: e.target.value }))} className="mt-1 min-h-12 w-full rounded-xl border border-white/10 px-3 text-white" style={{ backgroundColor: CSP_INPUT, colorScheme: "dark" }} /></label>
          <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>End<input type="datetime-local" value={timeOffForm.end_at} onChange={(e) => setTimeOffForm((prev) => ({ ...prev, end_at: e.target.value }))} className="mt-1 min-h-12 w-full rounded-xl border border-white/10 px-3 text-white" style={{ backgroundColor: CSP_INPUT, colorScheme: "dark" }} /></label>
          <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Reason (optional)<input type="text" value={timeOffForm.reason} onChange={(e) => setTimeOffForm((prev) => ({ ...prev, reason: e.target.value }))} className="mt-1 w-full rounded-xl border border-white/10 px-3 py-3 text-white" style={{ backgroundColor: CSP_INPUT }} /></label>
          <button type="button" onClick={() => void handleCreateTimeOff()} disabled={savingTimeOff} className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>{savingTimeOff ? "Saving…" : "Save time off"}</button>
        </div>
      </BottomSheet>
    </div>
  );
}
