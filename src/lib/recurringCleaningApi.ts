import { isOfflinePreviewMode, supabase } from "@/lib/supabase";
import { dormantFeatureError, isSupabaseFeatureUnavailable } from "@/lib/supabaseFeature";

export type RecurringCleaningCadence = "weekly" | "bi-weekly" | "monthly";
export type RecurringCleaningPlanStatus = "active" | "paused" | "ended";

export type RecurringCleaningPlan = {
  id: string;
  customerId: string;
  preferredProviderId: string | null;
  preferredProviderName: string | null;
  originBookingId: string;
  currentBookingId: string | null;
  cadence: RecurringCleaningCadence;
  serviceType: string;
  serviceAddress: Record<string, unknown>;
  status: RecurringCleaningPlanStatus;
  nextExpectedAt: string;
  pausedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type RecurringCleaningPlanRow = {
  id: string;
  customer_id: string;
  preferred_provider_id: string | null;
  origin_booking_id: string;
  current_booking_id: string | null;
  cadence: RecurringCleaningCadence;
  service_type: string;
  service_address: Record<string, unknown>;
  status: RecurringCleaningPlanStatus;
  next_expected_at: string;
  paused_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type MissedVisitResolutionResult = {
  bookingId: string;
  recurringPlanId: string | null;
  nextExpectedAt: string | null;
  paymentReviewRequired: boolean;
};

const PLAN_SELECT =
  "id,customer_id,preferred_provider_id,origin_booking_id,current_booking_id,cadence,service_type,service_address,status,next_expected_at,paused_at,ended_at,created_at,updated_at";

async function providerNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await supabase
    .from("provider_public_profiles")
    .select("id,full_name")
    .in("id", unique);
  if (error) return new Map();

  return new Map(
    (data ?? [])
      .map((row) => [String(row.id ?? ""), String(row.full_name ?? "").trim()] as const)
      .filter((entry) => entry[0] && entry[1])
  );
}

function mapPlan(row: RecurringCleaningPlanRow, names: Map<string, string>): RecurringCleaningPlan {
  return {
    id: row.id,
    customerId: row.customer_id,
    preferredProviderId: row.preferred_provider_id,
    preferredProviderName: row.preferred_provider_id ? names.get(row.preferred_provider_id) ?? null : null,
    originBookingId: row.origin_booking_id,
    currentBookingId: row.current_booking_id,
    cadence: row.cadence,
    serviceType: row.service_type,
    serviceAddress: row.service_address ?? {},
    status: row.status,
    nextExpectedAt: row.next_expected_at,
    pausedAt: row.paused_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMyRecurringCleaningPlans(): Promise<RecurringCleaningPlan[]> {
  if (isOfflinePreviewMode) return [];

  const { data, error } = await supabase
    .from("recurring_cleaning_plans")
    .select(PLAN_SELECT)
    .neq("status", "ended")
    .order("next_expected_at", { ascending: true });

  if (isSupabaseFeatureUnavailable(error)) return [];
  if (error) throw error;

  const rows = (data ?? []) as RecurringCleaningPlanRow[];
  const names = await providerNames(rows.flatMap((row) => (row.preferred_provider_id ? [row.preferred_provider_id] : [])));
  return rows.map((row) => mapPlan(row, names));
}

export async function updateMyRecurringCleaningPlan(
  planId: string,
  action: "pause" | "resume" | "end"
): Promise<RecurringCleaningPlan> {
  if (isOfflinePreviewMode) {
    throw new Error("Recurring cleaning controls are unavailable in offline preview mode.");
  }

  const { data, error } = await supabase.rpc("update_my_recurring_cleaning_plan", {
    p_plan_id: planId,
    p_action: action,
  });

  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Recurring cleaning controls");
  if (error) throw error;

  const row = data as RecurringCleaningPlanRow;
  const names = await providerNames(row.preferred_provider_id ? [row.preferred_provider_id] : []);
  return mapPlan(row, names);
}

export async function resolveMyMissedVisitWithoutReschedule(
  bookingId: string
): Promise<MissedVisitResolutionResult> {
  if (isOfflinePreviewMode) {
    throw new Error("Missed visit controls are unavailable in offline preview mode.");
  }

  const { data, error } = await supabase.rpc("resolve_my_missed_visit_without_reschedule", {
    p_booking_id: bookingId,
  });
  if (isSupabaseFeatureUnavailable(error)) throw dormantFeatureError("Missed visit resolution");
  if (error) throw error;

  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    bookingId: String(raw.booking_id ?? bookingId),
    recurringPlanId: raw.recurring_plan_id ? String(raw.recurring_plan_id) : null,
    nextExpectedAt: raw.next_expected_at ? String(raw.next_expected_at) : null,
    paymentReviewRequired: raw.payment_review_required === true,
  };
}
