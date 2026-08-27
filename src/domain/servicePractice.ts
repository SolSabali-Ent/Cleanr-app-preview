/**
 * Booking-derived signals for a CSP's residential service practice.
 *
 * These are descriptive continuity signals, not a trust score, ranking, or Kinex decision.
 * Cleanr derives them from durable booking truth so repeated household relationships can become
 * visible without redefining Jobs or manufacturing a separate notion of success.
 */

export interface ServicePracticeEvidence {
  status: string;
  customerId?: string | null;
  scheduledStart: string;
}

export interface ServicePracticeSnapshot {
  confirmedServicesCount: number;
  confirmedHouseholdsCount: number;
  repeatHouseholdsCount: number;
  repeatServicesCount: number;
  scheduledServicesCount: number;
  returningHouseholdsScheduledCount: number;
}

function validDateMs(value: string): number | null {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function buildServicePracticeSnapshot(
  evidence: ServicePracticeEvidence[],
  now: Date = new Date()
): ServicePracticeSnapshot {
  const confirmedByHousehold = new Map<string, number>();
  let confirmedServicesCount = 0;

  for (const item of evidence) {
    if (item.status !== "confirmed") continue;
    confirmedServicesCount += 1;
    const customerId = item.customerId?.trim();
    if (!customerId) continue;
    confirmedByHousehold.set(customerId, (confirmedByHousehold.get(customerId) ?? 0) + 1);
  }

  let repeatHouseholdsCount = 0;
  let repeatServicesCount = 0;
  for (const count of confirmedByHousehold.values()) {
    if (count < 2) continue;
    repeatHouseholdsCount += 1;
    repeatServicesCount += count - 1;
  }

  const nowMs = now.getTime();
  const scheduledReturningHouseholds = new Set<string>();
  let scheduledServicesCount = 0;

  for (const item of evidence) {
    if (item.status !== "accepted" && item.status !== "in_progress") continue;
    const scheduledMs = validDateMs(item.scheduledStart);
    if (scheduledMs == null || scheduledMs < nowMs) continue;
    scheduledServicesCount += 1;

    const customerId = item.customerId?.trim();
    if (customerId && confirmedByHousehold.has(customerId)) {
      scheduledReturningHouseholds.add(customerId);
    }
  }

  return {
    confirmedServicesCount,
    confirmedHouseholdsCount: confirmedByHousehold.size,
    repeatHouseholdsCount,
    repeatServicesCount,
    scheduledServicesCount,
    returningHouseholdsScheduledCount: scheduledReturningHouseholds.size,
  };
}
