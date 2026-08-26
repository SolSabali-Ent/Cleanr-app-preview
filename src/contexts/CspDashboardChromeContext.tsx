import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  showDashboardChrome: boolean;
  setShowDashboardChrome: (v: boolean) => void;
};

const CspDashboardChromeContext = createContext<Ctx | null>(null);

/**
 * Lets CspDashboardGate set whether provider bell + bottom nav should show.
 * Defaults to hidden so /csp/dashboard (index) never flashes dashboard chrome before gate resolves.
 */
export function CspDashboardChromeProvider({ children }: { children: ReactNode }) {
  const [showDashboardChrome, setShowDashboardChrome] = useState(false);

  const value = useMemo(
    () => ({ showDashboardChrome, setShowDashboardChrome }),
    [showDashboardChrome]
  );

  return <CspDashboardChromeContext.Provider value={value}>{children}</CspDashboardChromeContext.Provider>;
}

export function useCspDashboardChrome() {
  const ctx = useContext(CspDashboardChromeContext);
  if (!ctx) {
    throw new Error("useCspDashboardChrome must be used within CspDashboardChromeProvider");
  }
  return ctx;
}
