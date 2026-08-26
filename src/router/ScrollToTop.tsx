import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Resets scroll to top on every route change.
 * App uses window scroll (no internal scroll container at root).
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
