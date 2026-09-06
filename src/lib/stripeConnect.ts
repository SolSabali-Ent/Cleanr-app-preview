/**
 * Stripe Connect Express: get onboarding link and sync durable payout/activation status.
 * Used by Payout Setup flow.
 */

import { supabase } from "./supabase";

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : "Edge Function request failed";
  const context = (error as { context?: unknown } | null)?.context;

  if (context instanceof Response) {
    try {
      const payload = (await context.clone().json()) as { error?: unknown; message?: unknown } | null;
      const message = payload?.error ?? payload?.message;
      if (typeof message === "string" && message.trim()) return message.trim();
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        // Fall through to the Supabase client message.
      }
    }
  }

  return fallback;
}

export async function getStripeConnectLink(): Promise<{ url: string }> {
  const returnPath = "/csp/dashboard/application/payout-setup?stripe_return=1";
  const refreshPath = "/csp/dashboard/application/payout-setup";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const returnUrl = `${origin}${returnPath}`;
  const refreshUrl = `${origin}${refreshPath}`;

  const { data, error } = await supabase.functions.invoke("stripe-connect-link", {
    body: { return_url: returnUrl, refresh_url: refreshUrl },
  });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  const result = data as { url?: string; error?: string } | null;
  if (result?.error) throw new Error(result.error);
  if (!result?.url) throw new Error("No onboarding URL returned");
  return { url: result.url };
}

export async function syncStripeConnectStatus(): Promise<{ ready: boolean; activated: boolean }> {
  const { data, error } = await supabase.functions.invoke("stripe-connect-sync", { body: {} });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  const result = data as { ready?: boolean; activated?: boolean; error?: string } | null;
  if (result?.error && result.ready !== false) throw new Error(result.error);
  return {
    ready: result?.ready === true,
    activated: result?.activated === true,
  };
}
