import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { hasProviderInterestAtValue, hasProviderInterestSubmitted, type ProviderFlowProfile } from "@/lib/providerFlow";
import { clearOnboardingCompleteHandoff, clearProviderInterestHandoff } from "@/lib/cspFlowHandoff";

function dbConfirmsOnboardingComplete(m: CspFlowProfile): boolean {
  return (
    m.is_onboarded === true &&
    (hasProviderInterestAtValue(m.waiver_accepted_at) || hasProviderInterestAtValue(m.csp_terms_accepted_at))
  );
}

export type CspFlowProfile = ProviderFlowProfile & {
  id: string;
  full_name: string | null;
  phone: string | null;
  zip_code: string | null;
  service_radius_miles: number | null;
};

const FLOW_SELECT =
  "id, role, full_name, phone, zip_code, service_radius_miles, provider_interest_submitted_at, is_onboarded, csp_terms_accepted_at, waiver_accepted_at, identity_status, readiness_status, application_status, application_submitted_at, application_approved_at, marketplace_access";

function map(row: Record<string, unknown>): CspFlowProfile {
  const radiusRaw = row.service_radius_miles;
  const service_radius_miles =
    typeof radiusRaw === "number"
      ? radiusRaw
      : typeof radiusRaw === "string" && radiusRaw.trim() !== ""
        ? Number(radiusRaw)
        : null;

  return {
    id: String(row.id ?? ""),
    role: typeof row.role === "string" ? row.role : "customer",
    full_name: (row.full_name as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    zip_code: (row.zip_code as string | null) ?? null,
    service_radius_miles: Number.isFinite(service_radius_miles) ? service_radius_miles : null,
    provider_interest_submitted_at: (row.provider_interest_submitted_at as string | null) ?? null,
    is_onboarded: row.is_onboarded === true,
    csp_terms_accepted_at: (row.csp_terms_accepted_at as string | null) ?? null,
    waiver_accepted_at: (row.waiver_accepted_at as string | null) ?? null,
    identity_status: (row.identity_status as string | null) ?? null,
    readiness_status: (row.readiness_status as string | null) ?? null,
    application_status: (row.application_status as string | null) ?? null,
    application_submitted_at: (row.application_submitted_at as string | null) ?? null,
    application_approved_at: (row.application_approved_at as string | null) ?? null,
    marketplace_access: row.marketplace_access === true,
  };
}

export function useCspFlowProfile() {
  const location = useLocation();
  const { session, loading: sessionLoading } = useSession();
  const uid = session?.user?.id ?? null;
  const [profileFlow, setProfileFlow] = useState<CspFlowProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const prevUidRef = useRef<string | null>(null);

  const refreshFlowProfile = useCallback(async () => {
    if (!uid) {
      setProfileFlow(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select(FLOW_SELECT).eq("id", uid).single();
    if (error || !data) {
      setProfileFlow(null);
      setLoading(false);
      return;
    }
    const mapped = map(data as Record<string, unknown>);
    setProfileFlow(mapped);
    setLoading(false);
    if (hasProviderInterestSubmitted(mapped)) {
      clearProviderInterestHandoff(uid);
    }
    if (dbConfirmsOnboardingComplete(mapped)) {
      clearOnboardingCompleteHandoff(uid);
    }
  }, [uid]);

  useEffect(() => {
    if (sessionLoading) return;
    const prev = prevUidRef.current;
    if (prev && prev !== uid) {
      clearProviderInterestHandoff(prev);
      clearOnboardingCompleteHandoff(prev);
    }
    prevUidRef.current = uid;
    if (!uid && prev) {
      clearProviderInterestHandoff(prev);
      clearOnboardingCompleteHandoff(prev);
    }
  }, [uid, sessionLoading]);

  useEffect(() => {
    if (sessionLoading) return;
    void refreshFlowProfile();
  }, [sessionLoading, refreshFlowProfile, location.pathname]);

  return {
    uid,
    loading: sessionLoading || loading,
    profileFlow,
    refreshFlowProfile,
  };
}
