import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type CspDashboardGateBlockingValue = {
  gateBlocking: boolean;
  setGateBlocking: (v: boolean) => void;
};

const CspDashboardGateBlockingContext = createContext<CspDashboardGateBlockingValue | null>(null);

export function CspDashboardGateBlockingProvider({ children }: { children: ReactNode }) {
  const [gateBlocking, setGateBlockingState] = useState(true);
  const setGateBlocking = useCallback((v: boolean) => {
    setGateBlockingState(v);
  }, []);
  const value = useMemo(
    () => ({ gateBlocking, setGateBlocking }),
    [gateBlocking, setGateBlocking]
  );
  return (
    <CspDashboardGateBlockingContext.Provider value={value}>{children}</CspDashboardGateBlockingContext.Provider>
  );
}

export function useCspDashboardGateBlocking(): CspDashboardGateBlockingValue {
  const ctx = useContext(CspDashboardGateBlockingContext);
  if (!ctx) {
    throw new Error("useCspDashboardGateBlocking must be used within CspDashboardGateBlockingProvider");
  }
  return ctx;
}
