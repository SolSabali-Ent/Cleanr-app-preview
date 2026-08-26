import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useSession } from "../../../lib/useSession";
import { useProfile } from "../../../lib/useProfile";

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * Legacy ProviderApp shell: auth + CSP role only.
 * Onboarding URL decisions live in CspDashboardResolvedShell / OnboardingRoute — never here.
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading: sessionLoading } = useSession();
  const { profile, loading: profileLoading } = useProfile();

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info("[legacy-protected-route]", "redirect onboarding BLOCKED/REMOVED");
    }
  }, []);

  if (sessionLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading…</p>
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/csp/login" replace />;
  }
  if (!profile || profile.role !== "csp") {
    return <Navigate to="/" replace />;
  }

  // Incomplete CSP: use main app dashboard resolver (never navigate to /csp/dashboard/onboarding here).
  if (profile.is_onboarded !== true) {
    return <Navigate to="/csp/dashboard" replace />;
  }

  return <>{children}</>;
}
