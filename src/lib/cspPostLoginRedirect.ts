const DASHBOARD = "/csp/dashboard";

const STORAGE_KEYS = [
  "cleanr_return_to",
  "returnTo",
  "redirectTo",
  "intendedPath",
  "csp_next",
  "next",
] as const;

/** Stored or linked paths that should never resume post-login before dashboard resolver runs. */
export function isCspOnboardingResumePath(raw: string): boolean {
  const pathOnly = raw.trim().split("?")[0] ?? "";
  if (pathOnly === "/csp/dashboard/onboarding" || pathOnly.startsWith("/csp/dashboard/onboarding/")) {
    return true;
  }
  if (pathOnly === "/onboarding" || pathOnly.startsWith("/onboarding/")) return true;
  if (pathOnly === "/csp/onboarding" || pathOnly.startsWith("/csp/onboarding/")) return true;
  return false;
}

/**
 * Normalize legacy onboarding hrefs for in-app navigation (e.g. notification `path` payloads).
 */
export function normalizeCspNavigationHref(href: string): string {
  if (typeof href !== "string" || !href.startsWith("/")) return href;
  if (isCspOnboardingResumePath(href)) return DASHBOARD;
  return href;
}

/**
 * CSP login/signup should land on the dashboard; never resume a stored target that pins the user
 * on an onboarding URL before profile resolution on `/csp/dashboard`.
 */
export function resolveCspLoginNavigateTarget(): string {
  if (typeof window === "undefined") return DASHBOARD;

  for (const key of STORAGE_KEYS) {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
    } catch {
      continue;
    }
    if (!raw?.trim()) continue;
    const path = raw.trim();
    if (!isCspOnboardingResumePath(path)) continue;
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return DASHBOARD;
  }

  return DASHBOARD;
}
