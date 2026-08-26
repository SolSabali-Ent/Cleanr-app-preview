import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useStableSessionProfile } from "@/hooks/useStableSessionProfile";
import { useCspFlowProfile } from "@/hooks/useCspFlowProfile";
import {
  CspDashboardGateBlockingProvider,
  useCspDashboardGateBlocking,
} from "@/contexts/CspDashboardGateBlockingContext";
import {
  markCspDashboardEntrySplashComplete,
  resetCspDashboardEntrySplash,
  shouldShowCspDashboardEntrySplash,
} from "@/lib/cspDashboardEntrySplash";
import { traceCspFlow } from "@/lib/cspFlowTrace";
import {
  getCspFlowRedirectTarget,
  hasProviderInterestAtValue,
  hasProviderInterestSubmitted,
  pathnameIsOnCspSetupFunnelRoute,
} from "@/lib/providerFlow";
import {
  hasOnboardingCompleteHandoff,
  hasProviderInterestHandoff,
  mergeFlowProfileWithHandoffs,
} from "@/lib/cspFlowHandoff";
import { waitForMinimumDelay } from "@/lib/waitForMinimumDelay";
import { CleanrSplashLoading, DEFAULT_CLEANR_ENTRY_SPLASH_MIN_MS } from "./CleanrSplashLoading";

const DBG = import.meta.env.DEV;

function resLog(...args: unknown[]) {
  if (DBG) console.info("[csp-dashboard-resolver]", ...args);
}

/**
 * Parent resolver for all `/csp/dashboard/*` routes: blocks the tree until session + profile
 * match the current user (same `useCspFlowProfile` fetch as setup funnel screens). Handles onboarding
 * URL redirects here so children (including {@link CspDashboardGate}) never see unresolved
 * profile or race a second fetch before onboarding decisions.
 *
 * Branded entry splash (minimum delay) is coordinated here with {@link CspDashboardGate} via
 * {@link CspDashboardGateBlockingProvider}.
 */
export function CspDashboardResolvedShell() {
  return (
    <CspDashboardGateBlockingProvider>
      <CspDashboardResolvedShellInner />
    </CspDashboardGateBlockingProvider>
  );
}

function CspDashboardResolvedShellInner() {
  const location = useLocation();
  const { displayProfile, sessionUid: stableUid, sessionLoading } = useStableSessionProfile();
  const { uid: flowUid, loading: flowLoading, profileFlow } = useCspFlowProfile();
  const { gateBlocking } = useCspDashboardGateBlocking();
  const uid = flowUid ?? stableUid;

  const resolverPhaseRef = useRef<"loading" | "ready" | null>(null);
  const lastUidForPhaseReset = useRef<string | null>(null);
  if ((uid ?? null) !== lastUidForPhaseReset.current) {
    lastUidForPhaseReset.current = uid ?? null;
    resolverPhaseRef.current = null;
  }

  const wantsSplash = shouldShowCspDashboardEntrySplash(uid);
  const pathname = location.pathname;
  const isCandidateReadinessPath = pathname.startsWith("/csp/dashboard/candidate-readiness");
  const isOnboardingPath = pathname.startsWith("/csp/dashboard/onboarding");
  const isVerificationPath = pathname.startsWith("/csp/dashboard/verification");
  const isApplicationStatusPath = pathname.startsWith("/csp/dashboard/application-status");
  const isSetupFunnelPath = pathnameIsOnCspSetupFunnelRoute(pathname);
  const profileGateOpen = !sessionLoading && Boolean(stableUid && displayProfile && displayProfile.id === stableUid);
  const resolverBlocksOutlet = !profileGateOpen;
  /** True only when this shell would render {@link Outlet} (so {@link CspDashboardGate} is mounted). */
  const dashboardOutletEligible = useMemo(() => {
    if (sessionLoading || !stableUid || !displayProfile || displayProfile.id !== stableUid) return false;
    const profile = displayProfile;
    const isAdmin = profile.role === "admin";
    const isCsp = profile.role === "csp";
    if (!isCsp && !isAdmin) return false;
    const isOnboarded = isAdmin || profile.is_onboarded === true;
    if (isOnboarded && isOnboardingPath) return false;
    if (!isOnboarded && isCsp && !isOnboardingPath) return false;
    if (isSetupFunnelPath) return false;
    return true;
  }, [sessionLoading, stableUid, displayProfile, isOnboardingPath, isSetupFunnelPath]);

  const blockingForSplash = resolverBlocksOutlet || (dashboardOutletEligible && gateBlocking);

  const [splashOverlayOpen, setSplashOverlayOpen] = useState(false);
  const [splashExiting, setSplashExiting] = useState(false);
  const splashStartRef = useRef<number | null>(null);
  const hideSeqRef = useRef(0);

  useEffect(() => {
    if (!uid) {
      resetCspDashboardEntrySplash();
      splashStartRef.current = null;
      hideSeqRef.current += 1;
      setSplashOverlayOpen(false);
      setSplashExiting(false);
      return;
    }
    if (!wantsSplash) {
      splashStartRef.current = null;
      setSplashOverlayOpen(false);
      setSplashExiting(false);
      return;
    }
    if (blockingForSplash) {
      if (splashStartRef.current == null) {
        splashStartRef.current = performance.now();
        if (DBG) console.info("[cleanr-splash] show");
      }
      setSplashOverlayOpen(true);
      return;
    }
    const start = splashStartRef.current ?? performance.now();
    const seq = ++hideSeqRef.current;
    void (async () => {
      await waitForMinimumDelay(DEFAULT_CLEANR_ENTRY_SPLASH_MIN_MS, start);
      if (seq !== hideSeqRef.current || !uid) return;
      if (DBG) console.info("[cleanr-splash] minimum-delay-complete");
      setSplashExiting(true);
      await new Promise((r) => setTimeout(r, 220));
      if (seq !== hideSeqRef.current || !uid) return;
      setSplashOverlayOpen(false);
      setSplashExiting(false);
      markCspDashboardEntrySplashComplete(uid);
      splashStartRef.current = null;
      if (DBG) console.info("[cleanr-splash] hide");
    })();
  }, [uid, wantsSplash, blockingForSplash]);

  const showEntrySplash =
    wantsSplash && (blockingForSplash || splashOverlayOpen || splashExiting);

  let content: ReactNode = null;

  if (sessionLoading) {
    traceCspFlow("resolver", {
      branch: "resolver.loading",
      reason: "sessionLoading",
      pathname,
      uid,
    });
    if (DBG && resolverPhaseRef.current !== "loading") {
      resolverPhaseRef.current = "loading";
      resLog("loading");
    }
    content = null;
  } else if (!uid) {
    traceCspFlow("resolver", {
      branch: "resolver.redirect.login",
      reason: "missing_uid",
      pathname,
      uid,
      target: "/csp/login",
    });
    content = <Navigate to="/csp/login" replace />;
  } else if (flowLoading || !profileFlow || profileFlow.id !== uid) {
    traceCspFlow("resolver", {
      branch: "resolver.loading",
      reason: "flow_profile_unresolved",
      pathname,
      uid,
    });
    if (DBG && resolverPhaseRef.current !== "loading") {
      resolverPhaseRef.current = "loading";
      resLog("loading");
    }
    content = null;
  } else {
    const profile = profileFlow;
    const isAdmin = profile.role === "admin";
    const isCsp = profile.role === "csp";
    if (!isCsp && !isAdmin) {
      content = <Navigate to="/csp/login" replace />;
    } else {
      const handoffInterestSubmitted = uid ? hasProviderInterestHandoff(uid) : false;
      const handoffOnboardingComplete = uid ? hasOnboardingCompleteHandoff(uid) : false;
      const flowForRouting = mergeFlowProfileWithHandoffs(profile, uid);

      let target = getCspFlowRedirectTarget(pathname, flowForRouting);
      const candidatePath = "/csp/dashboard/candidate-readiness";
      const onboardingPath = "/csp/dashboard/onboarding";
      const verificationPath = "/csp/dashboard/verification";
      const computedInterestSubmitted = hasProviderInterestSubmitted(flowForRouting);
      const providerInterestAtAfterMerge = flowForRouting.provider_interest_submitted_at ?? null;
      const mergedIsOnboarded = flowForRouting.is_onboarded === true;
      const mergedWaiverAccepted = hasProviderInterestAtValue(flowForRouting.waiver_accepted_at);

      if (pathname.startsWith(onboardingPath) && target === candidatePath && handoffInterestSubmitted) {
        traceCspFlow("resolver", {
          branch: "resolver.block-backward.candidate-from-onboarding",
          reason: "handoff_interest_submitted",
          pathname,
          uid,
          profileId: profile.id,
          handoffInterestSubmitted: true,
          handoffOnboardingComplete,
          computedInterestSubmitted,
          mergedIsOnboarded,
          mergedWaiverAccepted,
          provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null,
          provider_interest_submitted_at_after_merge: providerInterestAtAfterMerge,
          target: candidatePath,
          flags: {
            isCandidateReadinessPath,
            isOnboardingPath,
            isVerificationPath,
            isApplicationStatusPath,
            isSetupFunnelPath,
          },
        });
        target = null;
      }

      if (
        pathname.startsWith(verificationPath) &&
        handoffOnboardingComplete &&
        (target === candidatePath || target === onboardingPath)
      ) {
        traceCspFlow("resolver", {
          branch: "resolver.block-backward.from-verification",
          reason: "onboarding_complete_handoff",
          pathname,
          uid,
          profileId: profile.id,
          handoffInterestSubmitted,
          handoffOnboardingComplete: true,
          computedInterestSubmitted,
          mergedIsOnboarded,
          mergedWaiverAccepted,
          provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null,
          provider_interest_submitted_at_after_merge: providerInterestAtAfterMerge,
          target,
          flags: {
            isCandidateReadinessPath,
            isOnboardingPath,
            isVerificationPath,
            isApplicationStatusPath,
            isSetupFunnelPath,
          },
        });
        target = null;
      }

      traceCspFlow("resolver", {
        branch: "resolver.flow-state",
        reason: "computed",
        pathname,
        uid,
        handoffInterestSubmitted,
        handoffOnboardingComplete,
        computedInterestSubmitted,
        mergedIsOnboarded,
        mergedWaiverAccepted,
        flags: {
          isCandidateReadinessPath,
          isOnboardingPath,
          isVerificationPath,
          isApplicationStatusPath,
          isSetupFunnelPath,
        },
        profileId: profile.id,
        provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null,
        provider_interest_submitted_at_after_merge: providerInterestAtAfterMerge,
        interestSubmitted: hasProviderInterestSubmitted(profile),
        is_onboarded: profile.is_onboarded,
        waiver_accepted_at: profile.waiver_accepted_at ?? null,
        identity_status: profile.identity_status ?? null,
        readiness_status: profile.readiness_status ?? null,
        application_status: profile.application_status ?? null,
        application_submitted_at: profile.application_submitted_at ?? null,
        application_approved_at: profile.application_approved_at ?? null,
        marketplace_access: profile.marketplace_access,
        target: target ?? null,
      });

      if (target && target !== pathname) {
        const branch =
          target === "/csp/dashboard/candidate-readiness"
            ? "resolver.redirect.candidate-readiness"
            : target === "/csp/dashboard/onboarding"
              ? "resolver.redirect.onboarding"
              : target === "/csp/dashboard/verification"
                ? "resolver.redirect.verification"
                : target === "/csp/dashboard/application-status"
                  ? "resolver.redirect.application-status"
                  : "resolver.redirect.dashboard";
        traceCspFlow("resolver", {
          branch,
          reason: "flow_target",
          pathname,
          uid,
          profileId: profile.id,
          handoffInterestSubmitted,
          handoffOnboardingComplete,
          computedInterestSubmitted,
          mergedIsOnboarded,
          mergedWaiverAccepted,
          provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null,
          provider_interest_submitted_at_after_merge: providerInterestAtAfterMerge,
          target,
        });
        content = <Navigate to={target} replace />;
      } else {
        traceCspFlow("resolver", {
          branch: "resolver.render.outlet",
          reason: "route_allowed",
          pathname,
          uid,
          profileId: profile.id,
          handoffInterestSubmitted,
          handoffOnboardingComplete,
          computedInterestSubmitted,
          mergedIsOnboarded,
          mergedWaiverAccepted,
          provider_interest_submitted_at: profile.provider_interest_submitted_at ?? null,
          provider_interest_submitted_at_after_merge: providerInterestAtAfterMerge,
          target: null,
        });
        if (DBG) {
          const prev = resolverPhaseRef.current;
          resolverPhaseRef.current = "ready";
          if (prev === "loading" || prev === null) resLog("render dashboard");
        } else {
          resolverPhaseRef.current = "ready";
        }
        content = <Outlet />;
      }
    }
  }

  return (
    <>
      {content}
      {showEntrySplash ? (
        <CleanrSplashLoading
          exiting={splashExiting}
          minDurationMs={DEFAULT_CLEANR_ENTRY_SPLASH_MIN_MS}
        />
      ) : null}
    </>
  );
}
