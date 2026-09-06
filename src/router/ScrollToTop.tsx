import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

type ScrollLocationState = {
  preserveScroll?: boolean;
};

/** New routes open at the top unless a route explicitly opts out. */
export function ScrollToTop() {
  const location = useLocation();

  useLayoutEffect(() => {
    const state = location.state as ScrollLocationState | null;
    if (state?.preserveScroll) return;

    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "auto" });
        return;
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.key, location.pathname, location.search, location.hash, location.state]);

  return null;
}
