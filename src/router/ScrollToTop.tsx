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
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

/**
 * New routes open at the top by default.
 *
 * iPhone Safari can keep the visual viewport offset after submitting a form while
 * the keyboard is closing. A single scrollTo during the route render is too early,
 * so we reset again while that viewport settles.
 *
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

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement !== document.body) {
      activeElement.blur();
    }

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

    const frame = window.requestAnimationFrame(() => {
      placePage();
      window.requestAnimationFrame(placePage);
    });
    const timers = [50, 150, 350].map((delay) => window.setTimeout(placePage, delay));

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", placePage);
    const stopViewportWatch = window.setTimeout(() => {
      viewport?.removeEventListener("resize", placePage);
    }, 450);

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(stopViewportWatch);
      viewport?.removeEventListener("resize", placePage);
    };
  }, [location.key, location.pathname, location.search, location.hash, location.state]);

  return null;
}
