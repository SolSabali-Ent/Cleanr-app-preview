// src/provider/ProviderContext.tsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { listBookingsForCustomer } from "../lib/bookingApi";
import type { PublicProvider } from "./types";

export type ProviderRelationshipSource = "durable_relationship" | "booking_history" | "customer_selection" | null;

type RelationshipDefaultRow = {
  provider_id: string;
  status: "active" | "paused" | "ended";
  customer_preferred: boolean;
  updated_at: string;
};

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
  const [durableProviderId, setDurableProviderId] = useState<string | null>(null);
  const [bookingProviderId, setBookingProviderId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProviders() {
      // provider_public_profiles owns provider discoverability. Relationship lifecycle only
      // controls automatic continuity below; it does not erase a CSP from marketplace/history.
      const { data } = await supabase
        .from("provider_public_profiles")
        .select("*")
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

    async function loadAutomaticContinuityDefaults() {
      try {
        const [relationshipResult, bookings] = await Promise.all([
          supabase
            .from("service_relationships")
            .select("provider_id,status,customer_preferred,updated_at")
            .order("updated_at", { ascending: false }),
          listBookingsForCustomer(),
        ]);
        if (!active) return;
        if (relationshipResult.error) throw relationshipResult.error;

        const latestByProvider = new Map<string, RelationshipDefaultRow>();
        for (const row of (relationshipResult.data ?? []) as RelationshipDefaultRow[]) {
          if (!latestByProvider.has(row.provider_id)) latestByProvider.set(row.provider_id, row);
        }

        const activeRelationships = Array.from(latestByProvider.values()).filter(
          (relationship) => relationship.status === "active"
        );
        const preferred = activeRelationships.find((relationship) => relationship.customer_preferred);
        const durable = preferred ?? activeRelationships[0] ?? null;
        setDurableProviderId(durable?.provider_id ?? null);

        const relationshipPausedOrEnded = new Set(
          Array.from(latestByProvider.values())
            .filter((relationship) => relationship.status !== "active")
            .map((relationship) => relationship.provider_id)
        );

        const withProvider = bookings
          .filter((booking) => Boolean(booking.provider_id))
          .filter((booking) => !relationshipPausedOrEnded.has(booking.provider_id as string))
          .sort((a, b) => {
            const aTime = new Date(a.scheduled_start || a.created_at).getTime();
            const bTime = new Date(b.scheduled_start || b.created_at).getTime();
            return bTime - aTime;
          })[0];
        setBookingProviderId(withProvider?.provider_id ?? null);
      } catch {
        if (active) {
          setDurableProviderId(null);
          setBookingProviderId(null);
        }
      }
    }

    void loadAutomaticContinuityDefaults();
    return () => {
      active = false;
    };
  }, []);

  const selectedProviderId = explicitProviderId ?? durableProviderId ?? bookingProviderId;

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [providers, selectedProviderId]
  );

  const relationshipSource: ProviderRelationshipSource = explicitProviderId
    ? "customer_selection"
    : durableProviderId
      ? "durable_relationship"
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
