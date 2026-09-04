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
    pathname.includes("/csp/dashboard/application") ||
    pathname.includes("/admin/full-app/csp/onboarding") ||
    pathname.includes("/admin/full-app/csp/terms") ||
    pathname.includes("/admin/full-app/csp/verification") ||
    pathname.includes("/admin/full-app/csp/candidate-readiness") ||
    pathname.includes("/admin/full-app/csp/application-status") ||
    pathname.includes("/admin/full-app/csp/application") ||
    pathname.includes("/admin/device/csp/onboarding") ||
    pathname.includes("/admin/device/csp/terms") ||
    pathname.includes("/admin/device/csp/verification") ||
    pathname.includes("/admin/device/csp/candidate-readiness") ||
    pathname.includes("/admin/device/csp/application-status") ||
    pathname.includes("/admin/device/csp/application")
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
