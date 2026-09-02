import { Navigate, useLocation } from "react-router-dom";

/**
 * Legacy compatibility route. Availability now lives inside the provider Calendar.
 * Keep old bookmarks/links working without maintaining a second availability UI.
 */
export function Availability() {
  const { pathname } = useLocation();
  const isAdminPreview = pathname.startsWith("/admin/full-app/csp/");
  const target = isAdminPreview
    ? "/admin/full-app/csp/calendar?tab=availability"
    : "/csp/dashboard/calendar?tab=availability";

  return <Navigate to={target} replace />;
}
