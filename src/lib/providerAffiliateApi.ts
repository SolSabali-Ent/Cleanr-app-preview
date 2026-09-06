import { supabase } from "@/lib/supabase";

export type ProviderAffiliatePendingRequest = {
  id: string;
  amountCents: number;
  status: "requested" | "approved" | "processing";
  requestedAt: string | null;
};

export type ProviderAffiliateDashboard = {
  active: boolean;
  code: string | null;
  status: "active" | "paused" | "ended" | null;
  joinedCount: number;
  qualifiedCount: number;
  availableCashCents: number;
  cashPaidCents: number;
  cashoutThresholdCents: number;
  cashoutEligible: boolean;
  payoutReady: boolean;
  pendingRequest: ProviderAffiliatePendingRequest | null;
  cashRewardCents: number;
  friendCreditCents: number;
  retentionBonusCents: number;
  retentionBookingCount: number;
  existingClientInviteCount: number;
  existingClientConnectedCount: number;
};

type RawDashboard = {
  active?: boolean;
  code?: string | null;
  status?: "active" | "paused" | "ended" | null;
  joined_count?: number;
  qualified_count?: number;
  available_cash_cents?: number;
  cash_paid_cents?: number;
  cashout_threshold_cents?: number;
  cashout_eligible?: boolean;
  payout_ready?: boolean;
  pending_request?: Record<string, unknown> | null;
  cash_reward_cents?: number;
  friend_credit_cents?: number;
  retention_bonus_cents?: number;
  retention_booking_count?: number;
  existing_client_invite_count?: number;
  existing_client_connected_count?: number;
};

function normalizeDashboard(raw: RawDashboard | null): ProviderAffiliateDashboard {
  const pending = raw?.pending_request && typeof raw.pending_request === "object"
    ? raw.pending_request
    : null;

  return {
    active: Boolean(raw?.active),
    code: raw?.code ?? null,
    status: raw?.status ?? null,
    joinedCount: Number(raw?.joined_count ?? 0),
    qualifiedCount: Number(raw?.qualified_count ?? 0),
    availableCashCents: Number(raw?.available_cash_cents ?? 0),
    cashPaidCents: Number(raw?.cash_paid_cents ?? 0),
    cashoutThresholdCents: Number(raw?.cashout_threshold_cents ?? 5000),
    cashoutEligible: Boolean(raw?.cashout_eligible),
    payoutReady: Boolean(raw?.payout_ready),
    pendingRequest: pending
      ? {
          id: String(pending.id ?? ""),
          amountCents: Number(pending.amount_cents ?? 0),
          status: String(pending.status ?? "requested") as ProviderAffiliatePendingRequest["status"],
          requestedAt: typeof pending.requested_at === "string" ? pending.requested_at : null,
        }
      : null,
    cashRewardCents: Number(raw?.cash_reward_cents ?? 2000),
    friendCreditCents: Number(raw?.friend_credit_cents ?? 1500),
    retentionBonusCents: Number(raw?.retention_bonus_cents ?? 1000),
    retentionBookingCount: Number(raw?.retention_booking_count ?? 3),
    existingClientInviteCount: Number(raw?.existing_client_invite_count ?? 0),
    existingClientConnectedCount: Number(raw?.existing_client_connected_count ?? 0),
  };
}

export async function getProviderAffiliateDashboard(): Promise<ProviderAffiliateDashboard> {
  const { data, error } = await supabase.rpc("get_my_provider_affiliate_dashboard");
  if (error) throw error;
  return normalizeDashboard(data as RawDashboard | null);
}

export async function activateProviderAffiliateAccount(): Promise<ProviderAffiliateDashboard> {
  const { error } = await supabase.rpc("get_or_create_my_provider_affiliate_account");
  if (error) throw error;
  return getProviderAffiliateDashboard();
}

export async function requestProviderAffiliateCashout(): Promise<ProviderAffiliateDashboard> {
  const { error } = await supabase.rpc("request_my_provider_affiliate_cashout");
  if (error) throw error;
  return getProviderAffiliateDashboard();
}

export function providerAffiliateUrl(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/signin?ref=${encodeURIComponent(code)}`;
}
