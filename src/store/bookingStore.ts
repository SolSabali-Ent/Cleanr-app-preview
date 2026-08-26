import { create } from "zustand";

export type FrequencyOption = "one_time" | "weekly" | "biweekly" | "monthly";

export type AddOnId =
  | "fridge"
  | "oven"
  | "laundry"
  | "windows"
  | "baseboards"
  | "deepclean";

export interface AddOn {
  id: AddOnId;
  label: string;
  price: number;
}

export interface ProviderOption {
  id: string;
  name: string;
  rating: number;
  reviewsCount: number;
  priceMultiplier: number;
  imageUrl: string;
  tagline: string;
  badges: string[];
}

export interface BookingState {
  zip: string;
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  addons: AddOnId[];
  frequency: FrequencyOption | null;
  date: string | null; // ISO date
  timeSlot: string | null;
  providerId: string | null;
  basePrice: number;
  addonsTotal: number;
  discount: number;
  totalPrice: number;
}

interface BookingStore extends BookingState {
  setZip: (zip: string) => void;
  setHomeDetails: (sqft: number, bedrooms: number, bathrooms: number) => void;
  setAddons: (addons: AddOnId[]) => void;
  setFrequency: (frequency: FrequencyOption) => void;
  setDateTime: (date: string, timeSlot: string) => void;
  setProvider: (providerId: string) => void;
  recalcPricing: () => void;
  reset: () => void;
}

export const ADDONS: AddOn[] = [
  { id: "fridge", label: "Inside Fridge", price: 20 },
  { id: "oven", label: "Inside Oven", price: 25 },
  { id: "laundry", label: "Laundry Folding", price: 15 },
  { id: "windows", label: "Windows (Interior)", price: 30 },
  { id: "baseboards", label: "Baseboards", price: 20 },
  { id: "deepclean", label: "Deep Clean Upgrade", price: 50 },
];

// Simple mock provider list for now
export const PROVIDERS: ProviderOption[] = [
  {
    id: "pro1",
    name: "Shine & Co.",
    rating: 4.9,
    reviewsCount: 128,
    priceMultiplier: 1,
    imageUrl: "https://images.pexels.com/photos/3760852/pexels-photo-3760852.jpeg",
    tagline: "Detail-obsessed, pet-friendly pros.",
    badges: ["Top Rated", "Verified", "Eco Products"],
  },
  {
    id: "pro2",
    name: "ATL Fresh Homes",
    rating: 4.7,
    reviewsCount: 89,
    priceMultiplier: 0.95,
    imageUrl: "https://images.pexels.com/photos/4107283/pexels-photo-4107283.jpeg",
    tagline: "Fast, efficient, and reliable.",
    badges: ["Great Value", "Evening Slots"],
  },
  {
    id: "pro3",
    name: "Luxury Clean Co.",
    rating: 5.0,
    reviewsCount: 54,
    priceMultiplier: 1.25,
    imageUrl: "https://images.pexels.com/photos/3965510/pexels-photo-3965510.jpeg",
    tagline: "For when you want it immaculate.",
    badges: ["Premium", "Deep Clean Experts"],
  },
];

const initialState: BookingState = {
  zip: "",
  sqft: null,
  bedrooms: null,
  bathrooms: null,
  addons: [],
  frequency: null,
  date: null,
  timeSlot: null,
  providerId: null,
  basePrice: 0,
  addonsTotal: 0,
  discount: 0,
  totalPrice: 0,
};

function calcBasePrice(sqft: number | null, bedrooms: number | null, bathrooms: number | null) {
  if (!sqft || !bedrooms || !bathrooms) return 0;
  let price = 60; // base
  price += Math.max(0, sqft - 800) * 0.05;
  price += (bedrooms - 1) * 10;
  price += (bathrooms - 1) * 15;
  return Math.round(price);
}

function calcAddonsTotal(addons: AddOnId[]) {
  return addons
    .map((id) => ADDONS.find((a) => a.id === id)?.price ?? 0)
    .reduce((sum, v) => sum + v, 0);
}

function calcFrequencyDiscount(frequency: FrequencyOption | null, subtotal: number) {
  if (!frequency) return 0;
  if (frequency === "weekly") return subtotal * 0.2;
  if (frequency === "biweekly") return subtotal * 0.15;
  if (frequency === "monthly") return subtotal * 0.1;
  return 0;
}

function calcProviderMultiplier(providerId: string | null) {
  if (!providerId) return 1;
  const provider = PROVIDERS.find((p) => p.id === providerId);
  return provider?.priceMultiplier ?? 1;
}

export const useBookingStore = create<BookingStore>((set, get) => ({
  ...initialState,

  setZip: (zip) => set({ zip }),

  setHomeDetails: (sqft, bedrooms, bathrooms) => {
    set({ sqft, bedrooms, bathrooms });
    get().recalcPricing();
  },

  setAddons: (addons) => {
    set({ addons });
    get().recalcPricing();
  },

  setFrequency: (frequency) => {
    set({ frequency });
    get().recalcPricing();
  },

  setDateTime: (date, timeSlot) => {
    set({ date, timeSlot });
  },

  setProvider: (providerId) => {
    set({ providerId });
    get().recalcPricing();
  },

  recalcPricing: () => {
    const state = get();
    const basePrice = calcBasePrice(state.sqft, state.bedrooms, state.bathrooms);
    const addonsTotal = calcAddonsTotal(state.addons);
    const providerMultiplier = calcProviderMultiplier(state.providerId);

    const subtotal = (basePrice + addonsTotal) * providerMultiplier;
    const discount = calcFrequencyDiscount(state.frequency, subtotal);
    const totalPrice = Math.max(0, Math.round(subtotal - discount));

    set({ basePrice, addonsTotal, discount: Math.round(discount), totalPrice });
  },

  reset: () => set(initialState),
}));

