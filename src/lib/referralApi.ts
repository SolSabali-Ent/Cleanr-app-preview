import { supabase } from "./supabase";

export type ReferralAttachResult = {
  attached: boolean;
  kind?: "general" | "existing_client";
  relationship_id?: string;
  provider_id?: string;
};

/**
 * Create a general referral as the current user (referrer). Returns shareable code.
 * General referrals do not imply that a service relationship already exists.
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
 * Create a single-use invitation for a customer relationship that predates Cleanr.
 * The invitation alone does not establish the relationship; the customer must
 * authenticate and accept the code first.
 */
export async function createExistingClientInvite(): Promise<{ id: string; code: string; kind: "existing_client" }> {
  const { data, error } = await supabase.rpc("create_existing_client_invite");
  if (error) throw error;
  const result = data as { id?: string; code?: string; kind?: string } | null;
  if (!result?.id || !result?.code || result.kind !== "existing_client") {
    throw new Error("Invalid create_existing_client_invite response");
  }
  return { id: result.id, code: result.code, kind: "existing_client" };
}

/**
 * Attach the current customer to an invitation by code after authentication.
 * For an existing-client invitation, the server also records customer consent
 * and establishes durable provider-brought relationship provenance.
 */
export async function attachRefereeByCode(code: string): Promise<ReferralAttachResult> {
  const { data, error } = await supabase.rpc("attach_referee_by_code", {
    p_code: code,
  });
  if (error) throw error;
  const result = data as ReferralAttachResult | null;
  return result ?? { attached: false };
}
