/**
 * Stripe Connect Express: get onboarding link and sync account status.
 * Used by Payout Setup flow.
 */

import { supabase } from "./supabase";

export async function getStripeConnectLink(): Promise<{ url: string }> {
  const returnPath = "/csp/dashboard/application/payout-setup?stripe_return=1";
  const refreshPath = "/csp/dashboard/application/payout-setup";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const returnUrl = `${origin}${returnPath}`;
  const refreshUrl = `${origin}${refreshPath}`;

  const { data, error } = await supabase.functions.invoke("stripe-connect-link", {
    body: { return_url: returnUrl, refresh_url: refreshUrl },
  });
  if (error) throw error;
  const result = data as { url?: string } | null;
  if (!result?.url) throw new Error("No onboarding URL returned");
  return { url: result.url };
}

export async function syncStripeConnectStatus(): Promise<{ ready: boolean }> {
  const { data, error } = await supabase.functions.invoke("stripe-connect-sync", { body: {} });
  if (error) throw error;
  const result = data as { ready?: boolean } | null;
  return { ready: result?.ready === true };
}
