import { supabase } from "./supabase";
import {
  clearOnboardingCompleteHandoff,
  clearProviderInterestHandoff,
} from "./cspFlowHandoff";
import { resetCspDashboardEntrySplash } from "./cspDashboardEntrySplash";

/**
 * Clear only ephemeral auth/setup UI state tied to the current signed-in user.
 * Durable product truth lives in Supabase and is intentionally untouched here.
 * Pending referral/invitation intent is also intentionally preserved and handled by
 * the relationship/referral flow rather than being treated as generic auth state.
 */
function clearEphemeralAuthState(userId: string | null) {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("csp_terms_accepted_pending");
    } catch {
      // Storage availability must not block sign-out.
    }
  }

  if (userId) {
    clearProviderInterestHandoff(userId);
    clearOnboardingCompleteHandoff(userId);
  }
  resetCspDashboardEntrySplash();
}

/**
 * Canonical explicit Cleanr sign-out action for user-facing surfaces.
 * Supabase remains the session authority. Callers own the post-logout route.
 */
export async function signOutCleanr(): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  clearEphemeralAuthState(session?.user?.id ?? null);

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
