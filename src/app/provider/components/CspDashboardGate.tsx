import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { attachRefereeByCode } from "@/lib/referralApi";
import { getStoredReferralCode, clearStoredReferralCode } from "@/lib/referralRef";
import { useCspDashboardChrome } from "@/contexts/CspDashboardChromeContext";
import { computeCspShowDashboardChrome } from "@/lib/cspDashboardChrome";
import { useCspDashboardGateBlocking } from "@/contexts/CspDashboardGateBlockingContext";
import { traceCspFlow } from "@/lib/cspFlowTrace";
import { pathnameIsOnCspSetupFunnelRoute } from "@/lib/providerFlow";

const DBG = import.meta.env.DEV;

function gateLog(...args: unknown[]) {
  if (DBG) console.info("[csp-dashboard-gate]", ...args);
}

/** Core profile columns for gate (avoid selecting newer columns that break if migration not applied). */
const PROFILE_GATE_SELECT =
  "role, is_onboarded, csp_terms_accepted_at, marketplace_access, application_status";

type CspGateReady = {
  kind: "ready";
  authorized: boolean;
  /** Admin skips wizard; CSP requires `is_onboarded === true` in DB. */
  isOnboarded: boolean;
  termsAccepted: boolean;
  marketplaceAccess: boolean;
  applicationStatus: string | null;
  isAdminUser: boolean;
  providerInterestSubmitted: boolean;
};

type CspGateState = { kind: "loading" } | CspGateReady;

export default function CspDashboardGate() {
  const location = useLocation();
  const { setShowDashboardChrome } = useCspDashboardChrome();
  const { setGateBlocking } = useCspDashboardGateBlocking();
  const [gate, setGate] = useState<CspGateState>({ kind: "loading" });

  const resolveSeqRef = useRef(0);
  const lastResolvedUserIdRef = useRef<string | null>(null);
  const outletReadyLoggedRef = useRef(false);

  // Resolve on mount + auth events only (not on pathname). Re-fetching on every in-dashboard
  // navigation reset loading and overlapped async work, which could briefly send onboarded CSPs
  // through `<Navigate to=".../onboarding" />` before a newer check completed.
  useEffect(() => {
    let mounted = true;

    async function resolveGate() {
      const seq = ++resolveSeqRef.current;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted || seq !== resolveSeqRef.current) return;

      const pathname = location.pathname;
      const prevUid = lastResolvedUserIdRef.current;
      const uid = session?.user?.id ?? null;

      const userLoggedOut = uid == null && prevUid != null;
      const userSwitched = uid != null && prevUid != null && uid !== prevUid;
      if (userLoggedOut || userSwitched) {
        outletReadyLoggedRef.current = false;
        setGate({ kind: "loading" });
      }

      if (!session?.user) {
        if (!mounted || seq !== resolveSeqRef.current) return;
        lastResolvedUserIdRef.current = null;
        setGate({
          kind: "ready",
          authorized: false,
          isOnboarded: false,
          termsAccepted: true,
          marketplaceAccess: false,
          applicationStatus: null,
          isAdminUser: false,
          providerInterestSubmitted: false,
        });
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select(PROFILE_GATE_SELECT)
        .eq("id", session.user.id)
        .single();

      if (!mounted || seq !== resolveSeqRef.current) return;

      if (error) {
        console.error("[CSP_GATE_STATE]", {
          pathname,
          userId: uid,
          profileError: error.message,
          profileCode: error.code,
        });
        lastResolvedUserIdRef.current = null;
        setGate({
          kind: "ready",
          authorized: false,
          isOnboarded: false,
          termsAccepted: false,
          marketplaceAccess: false,
          applicationStatus: null,
          isAdminUser: false,
          providerInterestSubmitted: false,
        });
        return;
      }

      const accepted = profile?.csp_terms_accepted_at != null;
      const isAdmin = profile?.role === "admin";
      const roleOk = profile?.role === "csp" || isAdmin;
      const isOnboarded = isAdmin || profile?.is_onboarded === true;

      let interestSubmitted = isAdmin;
      if (!isAdmin) {
        const { data: interestRow, error: interestErr } = await supabase
          .from("profiles")
          .select("provider_interest_submitted_at")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!mounted || seq !== resolveSeqRef.current) return;

        if (interestErr) {
          console.warn("[CSP_GATE_STATE]", {
            pathname,
            userId: uid,
            note: "provider_interest_submitted_at unreadable (migration lag or RLS); skipping candidate-readiness gate",
            interestError: interestErr.message,
            interestCode: interestErr.code,
          });
          interestSubmitted = true;
        } else {
          const interestAt = interestRow?.provider_interest_submitted_at;
          interestSubmitted = interestAt != null && interestAt !== "";
        }
      }

      const appStatus = (profile as Record<string, unknown>)?.application_status;
      const applicationStatus = typeof appStatus === "string" ? appStatus : null;

      if (accepted && typeof window !== "undefined") {
        sessionStorage.removeItem("csp_terms_accepted_pending");
      }

      if (!mounted || seq !== resolveSeqRef.current) return;

      lastResolvedUserIdRef.current = session.user.id;
      setGate({
        kind: "ready",
        authorized: roleOk,
        isOnboarded,
        termsAccepted: isAdmin || accepted,
        marketplaceAccess: isAdmin || profile?.marketplace_access === true,
        applicationStatus,
        isAdminUser: isAdmin,
        providerInterestSubmitted: interestSubmitted,
      });
    }

    void resolveGate();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void resolveGate();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const authorized = gate.kind === "ready" && gate.authorized;
  const onboardingComplete = gate.kind === "ready" && gate.isOnboarded;
  const termsAccepted = gate.kind === "ready" && gate.termsAccepted;
  const marketplaceAccess = gate.kind === "ready" && gate.marketplaceAccess;
  const applicationStatus = gate.kind === "ready" ? gate.applicationStatus : null;
  const isAdminUser = gate.kind === "ready" && gate.isAdminUser;
  const loading = gate.kind === "loading";
  const isSetupFunnelPath = pathnameIsOnCspSetupFunnelRoute(location.pathname);

  useLayoutEffect(() => {
    if (isSetupFunnelPath) {
      setGateBlocking(false);
      return;
    }
    setGateBlocking(loading);
  }, [loading, setGateBlocking, isSetupFunnelPath]);

  useEffect(() => {
    if (!authorized) return;
    const code = getStoredReferralCode();
    if (!code) return;
    clearStoredReferralCode();
    attachRefereeByCode(code)
      .catch(() => {})
      .finally(() => {
        clearStoredReferralCode();
      });
  }, [authorized]);

  const showDashboardChrome = useMemo(
    () =>
      computeCspShowDashboardChrome(
        loading,
        authorized,
        marketplaceAccess,
        isAdminUser,
        location.pathname
      ),
    [loading, authorized, marketplaceAccess, isAdminUser, location.pathname]
  );

  useLayoutEffect(() => {
    setShowDashboardChrome(showDashboardChrome);
  }, [showDashboardChrome, setShowDashboardChrome]);

  if (isSetupFunnelPath) {
    gateLog("skipped setup funnel route", location.pathname);
    traceCspFlow("gate", {
      branch: "gate.skipped.setup-funnel",
      reason: "defensive_bypass",
      pathname: location.pathname,
      target: null,
    });
    return <Outlet />;
  }

  if (loading) {
    traceCspFlow("gate", {
      branch: "gate.mounted",
      reason: "loading",
      pathname: location.pathname,
      target: null,
    });
    outletReadyLoggedRef.current = false;
    gateLog("loading");
    // Full-screen entry splash is coordinated in CspDashboardResolvedShell; do not stack a second loader here.
    return null;
  }

  if (!authorized) {
    traceCspFlow("gate", {
      branch: "gate.redirect.login",
      reason: "unauthorized",
      pathname: location.pathname,
      target: "/csp/login",
    });
    return <Navigate to="/csp/login" replace />;
  }

  // Onboarding URL decisions live in CspDashboardResolvedShell + providerFlow; onboarding mounts via OnboardingRoute.

  const isTermsRoute = location.pathname === "/csp/dashboard/terms";
  const pendingTermsAcceptance =
    typeof window !== "undefined" && sessionStorage.getItem("csp_terms_accepted_pending") === "true";

  if (
    authorized &&
    onboardingComplete &&
    !termsAccepted &&
    !pendingTermsAcceptance &&
    !isTermsRoute
  ) {
    traceCspFlow("gate", {
      branch: "gate.redirect.terms",
      reason: "terms_required",
      pathname: location.pathname,
      target: "/csp/dashboard/terms",
    });
    return <Navigate to="/csp/dashboard/terms" replace />;
  }

  const pathname = location.pathname;
  const isPayoutSetupRoute = pathname === "/csp/dashboard/application/payout-setup";
  const isVerificationRoute =
    pathname === "/csp/dashboard/application" ||
    pathname.startsWith("/csp/dashboard/application/") ||
    pathname === "/csp/dashboard/terms";

  const appStatusNorm = (applicationStatus ?? "").toLowerCase();
  const approvedLike = appStatusNorm === "approved" || appStatusNorm === "waitlisted";
  const reviewLike =
    appStatusNorm === "under_review" || appStatusNorm === "needs_review" || appStatusNorm === "rejected";
  const approvedButNotActive = applicationStatus === "approved" && !marketplaceAccess;
  const mayAccessPayoutSetup = approvedButNotActive;

  if (isPayoutSetupRoute && authorized && onboardingComplete && termsAccepted && !mayAccessPayoutSetup) {
    traceCspFlow("gate", {
      branch: "gate.redirect.application-status",
      reason: "invalid_payout_route",
      pathname,
      target: "/csp/dashboard/application-status",
    });
    return <Navigate to="/csp/dashboard/application-status" replace />;
  }

  if (
    authorized &&
    onboardingComplete &&
    termsAccepted &&
    !marketplaceAccess &&
    !isVerificationRoute
  ) {
    if (approvedLike) {
      traceCspFlow("gate", {
        branch: "gate.render.dashboard_pending",
        reason: "approved_marketplace_locked",
        pathname,
        target: null,
      });
      if (!outletReadyLoggedRef.current) {
        outletReadyLoggedRef.current = true;
        gateLog("ready");
      }
      return <Outlet />;
    }

    if (!reviewLike) {
      traceCspFlow("gate", {
        branch: "gate.render.dashboard",
        reason: "marketplace_locked_non_review_state",
        pathname,
        target: null,
      });
      if (!outletReadyLoggedRef.current) {
        outletReadyLoggedRef.current = true;
        gateLog("ready");
      }
      return <Outlet />;
    }

    traceCspFlow("gate", {
      branch: "gate.redirect.application-status",
      reason: "application_review_state",
      pathname,
      target: "/csp/dashboard/application-status",
    });
    return <Navigate to="/csp/dashboard/application-status" replace />;
  }

  if (!outletReadyLoggedRef.current) {
    outletReadyLoggedRef.current = true;
    gateLog("ready");
  }
  traceCspFlow("gate", {
    branch: "gate.render.dashboard",
    reason: "allowed",
    pathname,
    target: null,
  });
  return <Outlet />;
}
