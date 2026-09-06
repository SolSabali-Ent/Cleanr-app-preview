import { supabase } from "@/lib/supabase";

export type AffiliateRewardChoice = "cash" | "cleanr_credit";

export type ReadyAffiliateReward = {
  id: string;
  stage: "first_clean" | "retention_3" | string;
  createdAt: string | null;
};

export type CustomerAffiliateDashboard = {
  active: boolean;
  code: string | null;
  status: "active" | "paused" | "ended" | null;
  joinedCount: number;
  qualifiedCount: number;
  readyRewardCount: number;
  cashEarningsCents: number;
  cashPaidCents: number;
  cleanrCreditBalanceCents: number;
  cashoutThresholdCents: number;
  cashoutEligible: boolean;
  cashRewardCents: number;
  cleanrCreditRewardCents: number;
  friendCreditCents: number;
  retentionBonusCents: number;
  retentionBookingCount: number;
  readyRewards: ReadyAffiliateReward[];
};

type RawDashboard = {
  active?: boolean;
  code?: string | null;
  status?: "active" | "paused" | "ended" | null;
  joined_count?: number;
  qualified_count?: number;
  ready_reward_count?: number;
  cash_earnings_cents?: number;
  cash_paid_cents?: number;
  cleanr_credit_balance_cents?: number;
  cashout_threshold_cents?: number;
  cashout_eligible?: boolean;
  cash_reward_cents?: number;
  cleanr_credit_reward_cents?: number;
  friend_credit_cents?: number;
  retention_bonus_cents?: number;
  retention_booking_count?: number;
  ready_rewards?: Array<{ id?: string; stage?: string; created_at?: string | null }>;
};

function normalizeDashboard(raw: RawDashboard | null): CustomerAffiliateDashboard {
  return {
    active: Boolean(raw?.active),
    code: raw?.code ?? null,
    status: raw?.status ?? null,
    joinedCount: Number(raw?.joined_count ?? 0),
    qualifiedCount: Number(raw?.qualified_count ?? 0),
    readyRewardCount: Number(raw?.ready_reward_count ?? 0),
    cashEarningsCents: Number(raw?.cash_earnings_cents ?? 0),
    cashPaidCents: Number(raw?.cash_paid_cents ?? 0),
    cleanrCreditBalanceCents: Number(raw?.cleanr_credit_balance_cents ?? 0),
    cashoutThresholdCents: Number(raw?.cashout_threshold_cents ?? 5000),
    cashoutEligible: Boolean(raw?.cashout_eligible),
    cashRewardCents: Number(raw?.cash_reward_cents ?? 2000),
    cleanrCreditRewardCents: Number(raw?.cleanr_credit_reward_cents ?? 2500),
    friendCreditCents: Number(raw?.friend_credit_cents ?? 1500),
    retentionBonusCents: Number(raw?.retention_bonus_cents ?? 1000),
    retentionBookingCount: Number(raw?.retention_booking_count ?? 3),
    readyRewards: Array.isArray(raw?.ready_rewards)
      ? raw.ready_rewards
          .filter((reward) => typeof reward?.id === "string" && Boolean(reward.id))
          .map((reward) => ({
            id: String(reward.id),
            stage: String(reward.stage ?? "first_clean"),
            createdAt: reward.created_at ?? null,
          }))
      : [],
  };
}

export async function getCustomerAffiliateDashboard(): Promise<CustomerAffiliateDashboard> {
  const { data, error } = await supabase.rpc("get_my_customer_affiliate_dashboard");
  if (error) throw error;
  return normalizeDashboard(data as RawDashboard | null);
}

export async function activateCustomerAffiliateAccount(): Promise<CustomerAffiliateDashboard> {
  const { error } = await supabase.rpc("get_or_create_my_customer_affiliate_account");
  if (error) throw error;
  return getCustomerAffiliateDashboard();
}

export async function chooseCustomerAffiliateReward(
  rewardId: string,
  choice: AffiliateRewardChoice,
): Promise<CustomerAffiliateDashboard> {
  const { error } = await supabase.rpc("choose_my_customer_affiliate_reward", {
    p_reward_id: rewardId,
    p_choice: choice,
  });
  if (error) throw error;
  return getCustomerAffiliateDashboard();
}

export async function getMyCustomerValueSummary(): Promise<{
  cleanrCreditBalanceCents: number;
  acquisitionCreditCents: number;
}> {
  const { data, error } = await supabase.rpc("get_my_customer_value_summary");
  if (error) throw error;
  const raw = (data ?? {}) as {
    cleanr_credit_balance_cents?: number;
    acquisition_credit_cents?: number;
  };
  return {
    cleanrCreditBalanceCents: Number(raw.cleanr_credit_balance_cents ?? 0),
    acquisitionCreditCents: Number(raw.acquisition_credit_cents ?? 0),
  };
}

export function customerAffiliateUrl(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/signin?ref=${encodeURIComponent(code)}`;
}
