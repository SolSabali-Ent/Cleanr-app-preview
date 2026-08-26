/**
 * Persist and consume referral code from URL (?ref=CODE) across signin.
 * Capture on any page that might show ref=; consume once after auth in gates.
 */

const REFERRAL_CODE_KEY = "cleanr_referral_code";

function getSearch(): string {
  if (typeof window === "undefined") return "";
  return window.location.search;
}

/**
 * If current URL has ref=CODE, persist CODE to sessionStorage and return it.
 * Call on signin/landing pages so ref survives redirect to dashboard/app.
 */
export function captureReferralCodeFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(getSearch());
  const code = params.get("ref");
  const trimmed = code?.trim() || null;
  if (trimmed) {
    try {
      sessionStorage.setItem(REFERRAL_CODE_KEY, trimmed);
    } catch {
      // ignore storage errors
    }
    return trimmed;
  }
  return null;
}

export function getStoredReferralCode(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(REFERRAL_CODE_KEY);
  } catch {
    return null;
  }
}

export function clearStoredReferralCode(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(REFERRAL_CODE_KEY);
  } catch {
    // ignore
  }
}
