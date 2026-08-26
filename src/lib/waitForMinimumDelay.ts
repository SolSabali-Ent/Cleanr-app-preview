/**
 * Waits until at least `minMs` milliseconds have elapsed since `startedAtPerformanceNow`
 * (from `performance.now()`).
 */
export function waitForMinimumDelay(minMs: number, startedAtPerformanceNow: number): Promise<void> {
  const elapsed = performance.now() - startedAtPerformanceNow;
  const remaining = minMs - elapsed;
  if (remaining <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, remaining));
}
