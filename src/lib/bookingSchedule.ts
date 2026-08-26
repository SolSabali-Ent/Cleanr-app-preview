const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type SlotDateTime = {
  scheduledStartIso: string;
  scheduledEndIso: string;
};

type KnownSlotHours = {
  startHour24: number;
  endHour24: number;
};

const KNOWN_SLOT_TIMES: Record<string, KnownSlotHours> = {
  "8:00–10:00 AM": { startHour24: 8, endHour24: 10 },
  "10:00–12:00 PM": { startHour24: 10, endHour24: 12 },
  "12:00–2:00 PM": { startHour24: 12, endHour24: 14 },
  "2:00–4:00 PM": { startHour24: 14, endHour24: 16 },
  "4:00–6:00 PM": { startHour24: 16, endHour24: 18 },
};

function normalizeSlotLabel(slotLabel: string): string {
  return slotLabel
    .trim()
    .replace(/\s*-\s*/g, "–")
    .replace(/\s+/g, " ");
}

/**
 * Parse known display slot labels into local Date start/end.
 * Supports both en dash and hyphen input by normalizing to canonical labels.
 */
export function parseDisplayTimeSlot(dateIso: string, slotLabel: string): { start: Date; end: Date } | null {
  if (!DATE_RE.test(dateIso) || !slotLabel?.trim()) return null;
  const normalizedSlot = normalizeSlotLabel(slotLabel);
  const knownSlot = KNOWN_SLOT_TIMES[normalizedSlot];
  if (!knownSlot) return null;

  const start = new Date(`${dateIso}T00:00:00`);
  const end = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  start.setHours(knownSlot.startHour24, 0, 0, 0);
  end.setHours(knownSlot.endHour24, 0, 0, 0);

  if (end <= start) return null;
  return { start, end };
}

export function normalizeBookingSchedule(dateIso: string | null, slotLabel: string | null): SlotDateTime | null {
  if (!dateIso || !slotLabel) return null;
  const parsed = parseDisplayTimeSlot(dateIso, slotLabel);
  if (!parsed) return null;
  return {
    scheduledStartIso: parsed.start.toISOString(),
    scheduledEndIso: parsed.end.toISOString(),
  };
}

export const BOOKING_TIME_SLOT_CASES = [
  "8:00–10:00 AM",
  "10:00–12:00 PM",
  "12:00–2:00 PM",
  "2:00–4:00 PM",
  "4:00–6:00 PM",
] as const;

export const BOOKING_TIME_SLOT_EXPECTED_HOURS = [
  { slot: "8:00–10:00 AM", startHour24: 8, endHour24: 10 },
  { slot: "10:00–12:00 PM", startHour24: 10, endHour24: 12 },
  { slot: "12:00–2:00 PM", startHour24: 12, endHour24: 14 },
  { slot: "2:00–4:00 PM", startHour24: 14, endHour24: 16 },
  { slot: "4:00–6:00 PM", startHour24: 16, endHour24: 18 },
] as const;
