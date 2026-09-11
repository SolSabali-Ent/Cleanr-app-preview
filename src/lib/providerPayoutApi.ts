import { supabase } from "./supabase";

export type ProviderStripePayout = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  method: string | null;
  automatic: boolean;
  arrival_at: string | null;
  created_at: string | null;
  failure_code: string | null;
};

export type ProviderPayoutSummary = {
  ready: boolean;
  available_cents: number;
  pending_cents: number;
  instant_available_cents: number;
  schedule: {
    interval: "daily" | "weekly" | "monthly" | "manual" | string;
    weekly_day: string | null;
  };
  payouts: ProviderStripePayout[];
};

async function functionMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : "Payout request failed";
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json() as { error?: string; detail?: string };
      if (payload.detail) return payload.detail;
      if (payload.error) return payload.error;
    } catch {
      // fall through
    }
  }
  return fallback;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("provider-payout-center", { body });
  if (error) throw new Error(await functionMessage(error));
  const result = data as (T & { error?: string; detail?: string }) | null;
  if (result?.error) throw new Error(result.detail || result.error);
  if (!result) throw new Error("No payout response returned");
  return result;
}

export async function getProviderPayoutSummary(): Promise<ProviderPayoutSummary> {
  return invoke<ProviderPayoutSummary>({ action: "summary" });
}

export async function setProviderPayoutSchedule(interval: "daily" | "weekly" | "manual", weeklyDay = "friday") {
  return invoke<{ ok: true; interval: string; weekly_day: string | null }>({
    action: "set_schedule",
    interval,
    weekly_day: interval === "weekly" ? weeklyDay : undefined,
  });
}

export async function cashOutProviderBalance(instant = false) {
  return invoke<{ ok: true; payout_id: string; amount_cents: number; status: string; method: string | null; instant: boolean }>({
    action: "cash_out",
    instant,
  });
}

export async function getProviderStripeDashboardUrl(): Promise<string> {
  const result = await invoke<{ url: string }>({ action: "dashboard" });
  if (!result.url) throw new Error("Stripe did not return a dashboard link");
  return result.url;
}
