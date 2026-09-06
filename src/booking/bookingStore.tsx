import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

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
  contact: ContactInfo;
}

export interface BookingContextType {
  state: BookingState;
  update: (patch: Partial<BookingState>) => void;
  updateHomeDetails: (patch: Partial<HomeDetails>) => void;
  toggleExtra: (extra: string) => void;
  reset: () => void;
}

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
  contact: {
    name: "",
    email: "",
    phone: "",
  },
};

export const BookingContext = createContext<BookingContextType | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(initialState);

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
