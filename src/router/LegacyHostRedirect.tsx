import { useEffect } from "react";

const LEGACY_HOST = "go.cleanr.app";
const CANONICAL_ORIGIN = "https://cleanr.app";

export function LegacyHostRedirect() {
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hostname !== LEGACY_HOST) return;

    const { pathname, search, hash } = window.location;
    window.location.replace(`${CANONICAL_ORIGIN}${pathname}${search}${hash}`);
  }, []);

  return null;
}
