/**
 * Analytics stub. Logs events to console. Replace with real provider later.
 * Do not pass PII (contact, email, name). Only event names and non-PII ids (e.g. bookingId, incidentId).
 */
export function track(event: string, props?: Record<string, unknown>): void {
  console.log("[analytics]", event, props ?? "");
}

export const analytics = { track };
