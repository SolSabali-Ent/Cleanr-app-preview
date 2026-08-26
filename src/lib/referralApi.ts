import { supabase } from "./supabase";

/**
 * Create a referral as the current user (referrer). Returns shareable code.
 * Use when building a "Share" / "Get your link" flow. No UI in this file.
 */
export async function createReferral(code?: string | null): Promise<{ id: string; code: string }> {
  const { data, error } = await supabase.rpc("create_referral", {
    p_code: code ?? null,
  });
  if (error) throw error;
  const result = data as { id: string; code: string } | null;
  if (!result?.id || !result?.code) throw new Error("Invalid create_referral response");
  return result;
}

/**
 * Attach the current user as referee to a referral by code (e.g. from ?ref=CODE).
 * Call after signup/login when the user has a referral code. No self-referral.
 */
export async function attachRefereeByCode(code: string): Promise<{ attached: boolean }> {
  const { data, error } = await supabase.rpc("attach_referee_by_code", {
    p_code: code,
  });
  if (error) throw error;
  const result = data as { attached: boolean } | null;
  return result ?? { attached: false };
}
