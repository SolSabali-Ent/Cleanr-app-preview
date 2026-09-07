import type { Booking } from "../domain/booking";

export const DEFAULT_SERVICE_TIMEZONE = "America/New_York";

type ServiceDayBooking = Pick<Booking, "scheduled_start" | "status" | "service_timezone">;

export function serviceDateKey(value: string | Date, timeZone = DEFAULT_SERVICE_TIMEZONE): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type: "year" | "month" | "day") => parts.find((entry) => entry.type === type)?.value ?? "";
    const key = `${part("year")}-${part("month")}-${part("day")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
  } catch {
    return timeZone === DEFAULT_SERVICE_TIMEZONE ? null : serviceDateKey(date, DEFAULT_SERVICE_TIMEZONE);
  }
}

export function bookingServiceDayHasPassed(
  booking: Pick<ServiceDayBooking, "scheduled_start" | "service_timezone">,
  now = new Date()
): boolean {
  const timeZone = booking.service_timezone?.trim() || DEFAULT_SERVICE_TIMEZONE;
  const scheduledDay = serviceDateKey(booking.scheduled_start, timeZone);
  const today = serviceDateKey(now, timeZone);
  return Boolean(scheduledDay && today && scheduledDay < today);
}

export function isCurrentProviderWork(booking: ServiceDayBooking, now = new Date()): boolean {
  if (booking.status === "in_progress") return true;
  return booking.status === "accepted" && !bookingServiceDayHasPassed(booking, now);
}

export function isMissedAcceptedVisit(booking: ServiceDayBooking, now = new Date()): boolean {
  return booking.status === "accepted" && bookingServiceDayHasPassed(booking, now);
}

export function isCurrentCustomerUpcoming(booking: ServiceDayBooking, now = new Date()): boolean {
  if (booking.status === "in_progress" || booking.status === "completed_by_provider") return true;
  if (booking.status === "accepted") return !bookingServiceDayHasPassed(booking, now);
  return booking.status === "created";
}
