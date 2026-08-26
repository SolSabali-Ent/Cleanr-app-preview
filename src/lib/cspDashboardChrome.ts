/**
 * Pre-activation / gated funnel URLs: hide bell + bottom nav immediately (sync with useLocation),
 * so layout never flashes dashboard chrome before gate context updates.
 */
export function pathnameIsGatedPreactivation(pathname: string): boolean {
  return (
    pathname.includes("/csp/dashboard/onboarding") ||
    pathname.includes("/csp/dashboard/terms") ||
    pathname.includes("/csp/dashboard/verification") ||
    pathname.includes("/csp/dashboard/candidate-readiness") ||
    pathname.includes("/csp/dashboard/application-status") ||
    pathname.includes("/csp/dashboard/application")
  );
}

/**
 * Single source for when provider bell + bottom nav should appear.
 * Must stay aligned with CspDashboardGate funnel (pre-activation vs marketplace dashboard).
 */
export function computeCspShowDashboardChrome(
  loading: boolean,
  authorized: boolean,
  marketplaceAccess: boolean,
  isAdminUser: boolean,
  pathname: string
): boolean {
  if (loading) return false;
  if (!authorized) return false;
  if (pathnameIsGatedPreactivation(pathname)) {
    return false;
  }
  if (isAdminUser) return true;
  if (!marketplaceAccess) return false;
  return true;
}
