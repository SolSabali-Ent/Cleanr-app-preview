import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { clearPublicProviderBookingIntent, getPublicProviderBookingIntent } from "../lib/publicBookingIntent";

export interface HomeDetails {
  sqft: string;
  bedrooms: string;
  bathrooms: string;
}

export interface ContactInfo {
  name: string;
  email: string;
  phone: string;
}

export interface ServiceAddress {
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  formatted: string;
  lat: number | null;
  lng: number | null;
  verified: boolean;
}

export interface BookingState {
  zipcode: string | null;
  serviceAddress: ServiceAddress;
  serviceType: string | null;
  homeDetails: HomeDetails;
  frequency: "one-time" | "weekly" | "bi-weekly" | "monthly" | null;
  extras: string[];
  date: string | null;
  time: string | null;
  priorityRequested: boolean;
  requestedProviderId: string | null;
  requestedProviderName: string | null;
  contact: ContactInfo;
}

export interface BookingContextType {
  state: BookingState;
  update: (patch: Partial<BookingState>) => void;
  updateHomeDetails: (patch: Partial<HomeDetails>) => void;
  toggleExtra: (extra: string) => void;
  reset: () => void;
}

export const BOOKING_DRAFT_STORAGE_KEY = "cleanr:bookingDraft:v1";
export const BOOKING_STEP_STORAGE_KEY = "cleanr:bookingStep:v1";

const initialState: BookingState = {
  zipcode: null,
  serviceAddress: {
    street: "",
    unit: "",
    city: "",
    state: "GA",
    zip: "",
    formatted: "",
    lat: null,
    lng: null,
    verified: false,
  },
  serviceType: null,
  homeDetails: {
    sqft: "",
    bedrooms: "",
    bathrooms: "",
  },
  frequency: null,
  extras: [],
  date: null,
  time: null,
  priorityRequested: false,
  requestedProviderId: null,
  requestedProviderName: null,
  contact: {
    name: "",
    email: "",
    phone: "",
  },
};

function restoreBookingDraft(): BookingState {
  const publicIntent = getPublicProviderBookingIntent();

  if (typeof sessionStorage === "undefined") {
    if (!publicIntent) return initialState;
    clearPublicProviderBookingIntent();
    return {
      ...initialState,
      zipcode: publicIntent.zip,
      requestedProviderId: publicIntent.providerId,
      requestedProviderName: publicIntent.providerName,
    };
  }

  try {
    const raw = sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);
    const stored = raw ? JSON.parse(raw) as Partial<BookingState> : {};
    const restored: BookingState = {
      ...initialState,
      ...stored,
      serviceAddress: { ...initialState.serviceAddress, ...(stored.serviceAddress ?? {}) },
      homeDetails: { ...initialState.homeDetails, ...(stored.homeDetails ?? {}) },
      contact: { ...initialState.contact, ...(stored.contact ?? {}) },
      extras: Array.isArray(stored.extras) ? stored.extras.filter((item): item is string => typeof item === "string") : [],
      requestedProviderId: typeof stored.requestedProviderId === "string" && stored.requestedProviderId.trim() ? stored.requestedProviderId : null,
      requestedProviderName: typeof stored.requestedProviderName === "string" && stored.requestedProviderName.trim() ? stored.requestedProviderName : null,
    };

    if (publicIntent) {
      restored.requestedProviderId = publicIntent.providerId;
      restored.requestedProviderName = publicIntent.providerName;
      if (!restored.zipcode && publicIntent.zip) restored.zipcode = publicIntent.zip;
      clearPublicProviderBookingIntent();
    }

    return restored;
  } catch {
    if (!publicIntent) return initialState;
    clearPublicProviderBookingIntent();
    return {
      ...initialState,
      zipcode: publicIntent.zip,
      requestedProviderId: publicIntent.providerId,
      requestedProviderName: publicIntent.providerName,
    };
  }
}

export function clearPersistedBookingDraft() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
  sessionStorage.removeItem(BOOKING_STEP_STORAGE_KEY);
}

export const BookingContext = createContext<BookingContextType | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(() => restoreBookingDraft());

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(BOOKING_DRAFT_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const update = (patch: Partial<BookingState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  };

  const updateHomeDetails = (patch: Partial<HomeDetails>) => {
    setState((prev) => ({
      ...prev,
      homeDetails: { ...prev.homeDetails, ...patch },
    }));
  };

  const toggleExtra = (extra: string) => {
    setState((prev) => {
      const exists = prev.extras.includes(extra);
      return {
        ...prev,
        extras: exists
          ? prev.extras.filter((e) => e !== extra)
          : [...prev.extras, extra],
      };
    });
  };

  const reset = () => {
    clearPersistedBookingDraft();
    clearPublicProviderBookingIntent();
    setState(initialState);
  };

  return (
    <BookingContext.Provider value={{ state, update, updateHomeDetails, toggleExtra, reset }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used within BookingProvider");
  return ctx;
}
