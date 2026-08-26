/**
 * Booking contract — single source of truth.
 * Lives in domain: no UI, no Supabase-specific logic.
 *
 * Rules (non-negotiable):
 * - One booking row
 * - Status drives everything
 * - Roles never invent their own state
 * - UI reacts to status, not the other way around
 */

export type BookingStatus =
  | "created"
  | "accepted"
  | "in_progress"
  | "completed_by_provider"
  | "confirmed"
  | "disputed"
  | "cancelled";

export interface Booking {
  id: string;

  // parties
  customer_id: string | null;
  provider_id: string | null;

  // service
  service_type: string;
  address: string;
  scheduled_start: string;
  scheduled_end: string | null;

  // lifecycle
  status: BookingStatus;

  // metadata
  price_cents: number;
  stripe_payment_intent_id?: string | null;
  created_at: string;
  updated_at: string;

  /** Customer-owned durable access details (nullable until set). */
  access_notes?: string | null;
  gate_code?: string | null;
  parking_notes?: string | null;
  entry_instructions?: string | null;
  pet_notes?: string | null;
  surfaces_to_avoid?: string | null;
  customer_access_updated_at?: string | null;

  provider?: {
    id: string;
    full_name?: string | null;
    service_radius_miles?: number | null;
    marketplace_access?: boolean | null;
    created_at?: string | null;
    background_checked?: boolean | null;
    insured?: boolean | null;
    platform_verified?: boolean | null;
  } | null;
}

/** Authoritative lifecycle: only valid progression. Used for validation + RLS. */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  created: ["accepted", "cancelled"],
  accepted: ["in_progress", "cancelled", "disputed"],
  in_progress: ["completed_by_provider", "disputed"],
  completed_by_provider: ["confirmed", "disputed"],
  confirmed: [],
  disputed: ["confirmed", "cancelled"],
  cancelled: [],
};

/** Who is allowed to change status. Enforced by RLS; used for audit + trust. */
export const BOOKING_STATUS_ACTORS: Record<
  string,
  ("system" | "dispatcher" | "AI" | "provider" | "customer" | "admin")[]
> = {
  "created→accepted": ["provider", "dispatcher", "AI"],
  "accepted→in_progress": ["provider"],
  "in_progress→completed_by_provider": ["provider"],
  "completed_by_provider→confirmed": ["system", "customer", "admin"],
  "in_progress→disputed": ["customer", "provider"],
  "completed_by_provider→disputed": ["customer", "provider"],
  "*→disputed": ["customer", "provider"],
};

/** Check if a status transition is valid. */
export function canTransition(
  from: BookingStatus,
  to: BookingStatus
): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

/**
 * Screen mapping (intent-based).
 *
 * Customer: stays on BookingDetails; content changes by status.
 * Provider: moves between JobQueue → Home → JobDetails → Earnings / IncidentLog by status.
 */
export const BOOKING_STATUS_TO_CUSTOMER_VIEW: Record<
  BookingStatus,
  string
> = {
  created: "BookService → BookingDetails — “We’re finding a provider”",
  accepted: "BookingDetails — Provider accepted job",
  in_progress: "BookingDetails — Cleaning in progress",
  completed_by_provider: "BookingDetails — Waiting for confirmation window",
  confirmed: "BookingDetails — Receipt + review CTA",
  disputed: "BookingDetails — Issue resolution UI",
  cancelled: "BookingDetails — Booking cancelled",
};

export const BOOKING_STATUS_TO_PROVIDER_VIEW: Record<
  BookingStatus,
  string | null
> = {
  created: null, // Providers never see raw requests
  accepted: "Home — “Next job”",
  in_progress: "JobDetails — Active job controls",
  completed_by_provider: "Earnings — Awaiting confirmation",
  confirmed: "Earnings — Job confirmed",
  disputed: "IncidentLog — Required action",
  cancelled: null,
};
