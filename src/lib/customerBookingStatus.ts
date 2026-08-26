import type { BookingStatus } from "../domain/booking";

type CustomerStatus = BookingStatus | "payment_pending";

const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  created: "Request received",
  accepted: "Scheduled",
  in_progress: "In progress",
  completed_by_provider: "Completed",
  confirmed: "Confirmed",
  cancelled: "Canceled",
  disputed: "Under review",
  payment_pending: "Payment pending",
};

export function toCustomerBookingStatusLabel(status: string | null | undefined): string {
  if (!status) return "Payment pending";
  return CUSTOMER_STATUS_LABELS[status as CustomerStatus] ?? "Payment pending";
}

export function isHistoryBookingStatus(status: string | null | undefined): boolean {
  return (
    status === "completed_by_provider" ||
    status === "confirmed" ||
    status === "cancelled" ||
    status === "disputed"
  );
}

export function isUpcomingBookingStatus(status: string | null | undefined): boolean {
  return !isHistoryBookingStatus(status);
}
