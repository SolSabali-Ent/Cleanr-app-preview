import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useSession } from "./useSession";

export type ProfileRole = "customer" | "csp" | "admin";

export interface Profile {
  id: string;
  role: ProfileRole;
  full_name: string | null;
  phone: string | null;
  zip_code: string | null;
  service_radius_miles: number | null;
  location: unknown;
  is_onboarded: boolean;
  marketplace_access: boolean;
  identity_status: string | null;
  identity_document_path: string | null;
  background_check_status: string | null;
  insurance_status: string | null;
  insurance_coverage_cents: number | null;
  insurance_expires_at: string | null;
  agreement_accepted_at: string | null;
  csp_terms_accepted_at: string | null;
  csp_terms_version: string | null;
  screening_status: string | null;
  application_status: string | null;
  application_submitted_at: string | null;
  rejection_reason: string | null;
  transport_mode: string | null;
  travel_readiness_status: string | null;
  can_transport_supplies: boolean | null;
  travel_constraints: string | null;
  prefers_local_jobs_only: boolean | null;
  stripe_connect_ready: boolean | null;
  stripe_connect_account_id: string | null;
  cleaning_experience_bucket: string | null;
  has_own_equipment: boolean | null;
  has_reliable_transportation: boolean | null;
  provider_review_band: string | null;
  provider_interest_submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  // Use * so we do not request column names that are absent on older DBs (avoids whole-row fetch failure).
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return error || !data ? null : (data as unknown as Profile);
}

/**
 * Fetch profile for current user. Depends on useSession. refresh() re-fetches the profile.
 */
export function useProfile(): { profile: Profile | null; loading: boolean; refresh: () => Promise<void> } {
  const { session, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);

  const load = () => {
    if (!session) {
      setProfile(null);
      return Promise.resolve();
    }
    return fetchProfile(session.user.id).then((p) => {
      setProfile(p);
    });
  };

  useEffect(() => {
    void load();
  }, [session?.user?.id]);

  const refresh = () => load();

  // While a session exists, stay in "loading" until the fetched profile row matches that user.
  // Avoids a one-frame flash where profile is still null/stale before downstream gates read it.
  const profileMatchesSession = Boolean(session?.user?.id && profile?.id === session.user.id);
  const loading = sessionLoading || (Boolean(session?.user?.id) && !profileMatchesSession);

  return {
    profile,
    loading,
    refresh,
  };
}
