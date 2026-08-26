/**
 * One branded entry splash per CSP auth user per full page load (module resets on refresh).
 * Cleared when {@link resetCspDashboardEntrySplash} runs (logout / no user).
 */
let cspEntrySplashCompletedUid: string | null = null;

export function resetCspDashboardEntrySplash() {
  cspEntrySplashCompletedUid = null;
}

export function markCspDashboardEntrySplashComplete(uid: string) {
  cspEntrySplashCompletedUid = uid;
}

export function shouldShowCspDashboardEntrySplash(uid: string | null): boolean {
  return Boolean(uid && cspEntrySplashCompletedUid !== uid);
}
