// src/provider/ProviderContext.tsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { listBookingsForCustomer } from "../lib/bookingApi";
import type { PublicProvider } from "./types";

export type ProviderRelationshipSource = "booking_history" | "customer_selection" | null;

interface ProviderContextValue {
  providers: PublicProvider[];
  selectedProvider: PublicProvider | null;
  relationshipSource: ProviderRelationshipSource;
  selectProvider: (id: string) => void;
}

const ProviderContext = createContext<ProviderContextValue | undefined>(undefined);

const LOCAL_STORAGE_KEY = "cleanr:selectedProviderId";

export function ProviderContextProvider({ children }: { children: ReactNode }) {
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [explicitProviderId, setExplicitProviderId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(LOCAL_STORAGE_KEY);
  });
  const [bookingProviderId, setBookingProviderId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProviders() {
      const { data } = await supabase
        .from("provider_public_profiles")
        .select("*")
        .eq("marketplace_access", true)
        .order("full_name", { ascending: true });
      if (!active) return;
      setProviders((data ?? []) as PublicProvider[]);
    }
    void loadProviders();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadRelationshipFromBookings() {
      try {
        const bookings = await listBookingsForCustomer();
        if (!active) return;
        const withProvider = bookings
          .filter((booking) => Boolean(booking.provider_id))
          .sort((a, b) => {
            const aTime = new Date(a.scheduled_start || a.created_at).getTime();
            const bTime = new Date(b.scheduled_start || b.created_at).getTime();
            return bTime - aTime;
          })[0];
        setBookingProviderId(withProvider?.provider_id ?? null);
      } catch {
        if (active) setBookingProviderId(null);
      }
    }
    void loadRelationshipFromBookings();
    return () => {
      active = false;
    };
  }, []);

  const selectedProviderId = explicitProviderId ?? bookingProviderId;

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [providers, selectedProviderId]
  );

  const relationshipSource: ProviderRelationshipSource = explicitProviderId
    ? "customer_selection"
    : bookingProviderId
      ? "booking_history"
      : null;

  const selectProvider = (id: string) => {
    setExplicitProviderId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, id);
    }
  };

  return (
    <ProviderContext.Provider
      value={{
        providers,
        selectedProvider,
        relationshipSource,
        selectProvider,
      }}
    >
      {children}
    </ProviderContext.Provider>
  );
}

export function useProviderContext() {
  const ctx = useContext(ProviderContext);
  if (!ctx) {
    throw new Error("useProviderContext must be used within ProviderContextProvider");
  }
  return ctx;
}
