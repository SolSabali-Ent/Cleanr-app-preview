import { SERVICE_DISPLAY_NAME } from "../lib/serviceCatalog";

export type MockBookingStatus = "upcoming" | "completed" | "cancelled";

export interface MockBooking {
  id: string;
  date: string; // ISO date
  timeWindow: string;
  serviceType: string;
  addressLine1: string;
  city: string;
  price: number;
  status: MockBookingStatus;
  providerName: string;
  providerRating: number;
  providerReviews: number;
}

export const mockBookings: MockBooking[] = [
  {
    id: "8f9b7c74-7d8e-4f5a-9f9d-6bf6d30cae81",
    date: "2025-01-21",
    timeWindow: "9:00–11:00 AM",
    serviceType: SERVICE_DISPLAY_NAME.standard,
    addressLine1: "123 Maple Street",
    city: "Atlanta, GA",
    price: 129,
    status: "upcoming",
    providerName: "Shine & Co.",
    providerRating: 4.9,
    providerReviews: 128,
  },
  {
    id: "5b8e0f58-8f44-4f39-a7f8-7adf20cd1f12",
    date: "2024-12-15",
    timeWindow: "2:00–4:00 PM",
    serviceType: SERVICE_DISPLAY_NAME.deep,
    addressLine1: "456 Oak Avenue",
    city: "Atlanta, GA",
    price: 189,
    status: "completed",
    providerName: "GreenGlow Cleaning",
    providerRating: 4.8,
    providerReviews: 93,
  },
];

