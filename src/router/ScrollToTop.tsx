import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

type ScrollLocationState = {
  preserveScroll?: boolean;
};

function resetPageScroll() {
  const scrollingElement = document.scrollingElement;
  if (scrollingElement) scrollingElement.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo(0, 0);
}

/**
 * New routes start at the top by default.
 * Intentional exceptions:
 * - hash links scroll to their target section
 * - route state can explicitly opt out with { preserveScroll: true }
 */
export function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);

  useLayoutEffect(() => {
    const state = location.state as ScrollLocationState | null;
    if (state?.preserveScroll) return;

    const placePage = () => {
      if (location.hash) {
        const id = decodeURIComponent(location.hash.slice(1));
        const target = document.getElementById(id);
        if (target) {
          target.scrollIntoView({ block: "start", behavior: "auto" });
          return;
        }
      }
      resetPageScroll();
    };

    placePage();
    const frame = window.requestAnimationFrame(placePage);
    return () => window.cancelAnimationFrame(frame);
  }, [location.key, location.pathname, location.search, location.hash, location.state]);

  return null;
}
