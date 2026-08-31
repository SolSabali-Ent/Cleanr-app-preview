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
  "id, role, full_name, phone, zip_code, service_radius_miles, provider_interest_submitted_at, is_onboarded, csp_terms_accepted_at, waiver_accepted_at, identity_status, identity_document_path, readiness_status, background_check_status, screening_status, travel_readiness_status, application_status, application_submitted_at, application_approved_at, rejection_reason, stripe_connect_ready, stripe_connect_account_id, marketplace_access";

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
    identity_document_path: (row.identity_document_path as string | null) ?? null,
    readiness_status: (row.readiness_status as string | null) ?? null,
    background_check_status: (row.background_check_status as string | null) ?? null,
    screening_status: (row.screening_status as string | null) ?? null,
    travel_readiness_status: (row.travel_readiness_status as string | null) ?? null,
    application_status: (row.application_status as string | null) ?? null,
    application_submitted_at: (row.application_submitted_at as string | null) ?? null,
    application_approved_at: (row.application_approved_at as string | null) ?? null,
    rejection_reason: (row.rejection_reason as string | null) ?? null,
    stripe_connect_ready: row.stripe_connect_ready === true,
    stripe_connect_account_id: (row.stripe_connect_account_id as string | null) ?? null,
    marketplace_access: row.marketplace_access === true,
  };
}

function adminPreviewProfile(profile: CspFlowProfile, pathname: string): CspFlowProfile {
  const stamp = profile.provider_interest_submitted_at ?? new Date(0).toISOString();
  const accepted = profile.csp_terms_accepted_at ?? new Date(0).toISOString();
  const base: CspFlowProfile = {
    ...profile,
    role: "csp",
  };

  if (pathname.includes("/candidate-readiness")) {
    return {
      ...base,
      provider_interest_submitted_at: null,
      is_onboarded: false,
      csp_terms_accepted_at: null,
      waiver_accepted_at: null,
      application_status: "not_started",
      marketplace_access: false,
    };
  }

  if (pathname.includes("/onboarding")) {
    return {
      ...base,
      provider_interest_submitted_at: stamp,
      is_onboarded: false,
      csp_terms_accepted_at: null,
      waiver_accepted_at: null,
      application_status: "not_started",
      marketplace_access: false,
    };
  }

  if (pathname.includes("/verification")) {
    return {
      ...base,
      provider_interest_submitted_at: stamp,
      is_onboarded: true,
      waiver_accepted_at: accepted,
      csp_terms_accepted_at: null,
      application_status: "not_started",
      marketplace_access: false,
    };
  }

  if (pathname.includes("/application-status")) {
    return {
      ...base,
      provider_interest_submitted_at: stamp,
      is_onboarded: true,
      waiver_accepted_at: accepted,
      csp_terms_accepted_at: accepted,
      application_status: "under_review",
      marketplace_access: false,
    };
  }

  if (pathname.endsWith("/terms")) {
    return {
      ...base,
      provider_interest_submitted_at: stamp,
      is_onboarded: true,
      waiver_accepted_at: accepted,
      csp_terms_accepted_at: null,
      application_status: "not_started",
      marketplace_access: false,
    };
  }

  return {
    ...base,
    provider_interest_submitted_at: stamp,
    is_onboarded: true,
    waiver_accepted_at: accepted,
    csp_terms_accepted_at: accepted,
    application_status: profile.application_status ?? "approved",
    application_approved_at: profile.application_approved_at ?? accepted,
    marketplace_access: true,
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
    let mapped = map(data as Record<string, unknown>);

    if (location.pathname.startsWith("/admin/full-app/csp")) {
      const { data: admin } = await supabase.rpc("is_admin", { uid });
      if (admin === true) mapped = adminPreviewProfile(mapped, location.pathname);
    }

    setProfileFlow(mapped);
    setLoading(false);
    if (hasProviderInterestSubmitted(mapped)) clearProviderInterestHandoff(uid);
    if (dbConfirmsOnboardingComplete(mapped)) clearOnboardingCompleteHandoff(uid);
  }, [uid, location.pathname]);

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

  return { uid, loading: sessionLoading || loading, profileFlow, refreshFlowProfile };
}
