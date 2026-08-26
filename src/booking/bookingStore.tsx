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

export interface BookingState {
  zipcode: string | null;
  serviceType: string | null;
  homeDetails: HomeDetails;
  frequency: "one-time" | "weekly" | "bi-weekly" | "monthly" | null;
  extras: string[];
  date: string | null;
  time: string | null;
  contact: ContactInfo;
  selectedProviderId: string | null;
  selectedProviderName?: string | null;
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
  contact: {
    name: "",
    email: "",
    phone: "",
  },
  selectedProviderId: null,
  selectedProviderName: undefined,
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
    <BookingContext.Provider
      value={{
        state,
        update,
        updateHomeDetails,
        toggleExtra,
        reset,
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const ctx = useContext(BookingContext);
  if (!ctx) {
    throw new Error("useBooking must be used within BookingProvider");
  }
  return ctx;
}
