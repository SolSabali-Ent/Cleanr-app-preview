/**
 * Provider ↔ customer booking thread: open only while the job is active.
 * After completion / terminal states, in-app messaging is closed from the provider job flow.
 */

const MESSAGING_CLOSED_STATUSES = new Set(
  [
    "completed_by_provider",
    "completed",
    "cancelled",
    "canceled",
    "refunded",
    "disputed_closed",
  ].map((s) => s.toLowerCase())
);

export function isProviderCustomerMessagingOpen(status: string | null | undefined): boolean {
  if (status == null || String(status).trim() === "") return false;
  return !MESSAGING_CLOSED_STATUSES.has(status.trim().toLowerCase());
}
