import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Navigate to the previous in-app entry when React Router has one.
 * Direct/deep links start at history idx 0, so fall back to a known app route
 * instead of sending the user out of Cleanr or leaving them stranded.
 */
export function useSafeBack(appFallback: string, adminPreviewFallback?: string) {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    const historyIndex =
      typeof window !== "undefined" && typeof window.history.state?.idx === "number"
        ? window.history.state.idx
        : 0;

    if (historyIndex > 0) {
      navigate(-1);
      return;
    }

    const fallback =
      location.pathname.startsWith("/admin/full-app/") && adminPreviewFallback
        ? adminPreviewFallback
        : appFallback;

    navigate(fallback, { replace: true });
  }, [adminPreviewFallback, appFallback, location.pathname, navigate]);
}
