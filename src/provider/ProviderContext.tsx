// src/provider/ProviderContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../lib/supabase";
import type { PublicProvider } from "./types";

interface ProviderContextValue {
  providers: PublicProvider[];
  selectedProvider: PublicProvider | null;
  selectProvider: (id: string) => void;
}

const ProviderContext = createContext<ProviderContextValue | undefined>(
  undefined
);

const LOCAL_STORAGE_KEY = "cleanr:selectedProviderId";

export function ProviderContextProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [providers, setProviders] = useState<PublicProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return null;
      return localStorage.getItem(LOCAL_STORAGE_KEY);
    }
  );

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
    if (!selectedProviderId && providers.length > 0) {
      setSelectedProviderId(providers[0].id);
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, providers[0].id);
      }
    }
  }, [selectedProviderId, providers]);

  const selectedProvider =
    providers.find((p) => p.id === selectedProviderId) ?? providers[0] ?? null;

  const selectProvider = (id: string) => {
    setSelectedProviderId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, id);
    }
  };

  return (
    <ProviderContext.Provider
      value={{
        providers,
        selectedProvider,
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

