export type BookingRescheduleStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "superseded";

export interface BookingRescheduleRequest {
  id: string;
  bookingId: string;
  customerId: string;
  providerId: string;
  requestedBy: string;
  originalStart: string;
  originalEnd: string | null;
  proposedStart: string;
  proposedEnd: string;
  note: string | null;
  status: BookingRescheduleStatus;
  respondedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
