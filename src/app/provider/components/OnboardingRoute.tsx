import { Suspense, lazy, useEffect } from "react";
import { traceCspFlow } from "@/lib/cspFlowTrace";
import { CspNeutralLoading } from "./CspNeutralLoading";

const OnboardingWizard = lazy(() => import("../screens/OnboardingWizard"));

/**
 * Thin shell: resolver owns setup sequencing; this only lazy-loads the wizard and traces mount.
 * No second profile gate — OnboardingWizard uses `useCspFlowProfile` only.
 */
export function OnboardingRoute() {
  useEffect(() => {
    traceCspFlow("onboarding-route", {
      branch: "onboarding-route.render-wizard",
      reason: "resolver_owns_setup_flow",
      pathname: "/csp/dashboard/onboarding",
    });
  }, []);

  return (
    <Suspense fallback={<CspNeutralLoading />}>
      <OnboardingWizard />
    </Suspense>
  );
}
