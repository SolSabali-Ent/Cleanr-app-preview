import { supabase } from "@/lib/supabase";

export type CustomerAffiliateDashboard = {
  active: boolean;
  code: string | null;
  status: "active" | "paused" | "ended" | null;
  joinedCount: number;
  qualifiedCount: number;
  pendingRewardCount: number;
  approvedRewardCount: number;
  paidRewardCount: number;
  approvedRewardCents: number;
  paidRewardCents: number;
};

type RawDashboard = {
  active?: boolean;
  code?: string | null;
  status?: "active" | "paused" | "ended" | null;
  joined_count?: number;
  qualified_count?: number;
  pending_reward_count?: number;
  approved_reward_count?: number;
  paid_reward_count?: number;
  approved_reward_cents?: number;
  paid_reward_cents?: number;
};

function normalizeDashboard(raw: RawDashboard | null): CustomerAffiliateDashboard {
  return {
    active: Boolean(raw?.active),
    code: raw?.code ?? null,
    status: raw?.status ?? null,
    joinedCount: Number(raw?.joined_count ?? 0),
    qualifiedCount: Number(raw?.qualified_count ?? 0),
    pendingRewardCount: Number(raw?.pending_reward_count ?? 0),
    approvedRewardCount: Number(raw?.approved_reward_count ?? 0),
    paidRewardCount: Number(raw?.paid_reward_count ?? 0),
    approvedRewardCents: Number(raw?.approved_reward_cents ?? 0),
    paidRewardCents: Number(raw?.paid_reward_cents ?? 0),
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

export function customerAffiliateUrl(code: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/signin?ref=${encodeURIComponent(code)}`;
}
