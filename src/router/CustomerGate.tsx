import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase, isOfflinePreviewMode } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { attachRefereeByCode } from "@/lib/referralApi";
import { getStoredReferralCode, clearStoredReferralCode } from "@/lib/referralRef";

export function CustomerGate({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
  const { pathname } = useLocation();
  const [loading, setLoading] = useState(!isOfflinePreviewMode);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const hadAuthenticatedSessionRef = useRef(false);
  const accessSeqRef = useRef(0);

  useEffect(() => {
    if (isOfflinePreviewMode) {
      setRedirectPath(null);
      setLoading(false);
      return;
    }

    if (sessionLoading) return;

    let mounted = true;
    const seq = ++accessSeqRef.current;

    async function checkCustomerAccess() {
      const user = session?.user ?? null;

      if (!user) {
        if (mounted && seq === accessSeqRef.current) {
          setRedirectPath(hadAuthenticatedSessionRef.current ? "/signin?reason=session-ended" : "/signin");
          setLoading(false);
        }
        return;
      }

      hadAuthenticatedSessionRef.current = true;
      setLoading(true);
      setRedirectPath(null);

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!mounted || seq !== accessSeqRef.current) return;

      if (error || !profile) {
        setRedirectPath("/signin?reason=profile-unavailable");
        setLoading(false);
        return;
      }

      const canAccessApp = profile.role === "customer" || profile.role === "admin";
      if (!canAccessApp) {
        setRedirectPath("/dashboard");
        setLoading(false);
        return;
      }

      if (profile.role === "customer") {
        const code = getStoredReferralCode();
        if (code) {
          try {
            const result = await attachRefereeByCode(code);
            if (result.attached || result.attached === false) {
              clearStoredReferralCode();
            }

            // Affiliate invitations are customer-acquisition links, not CSP relationship
            // invitations. If auth initially sent the customer toward the provider relationship
            // surface, bring them home after the referral benefit has been attached.
            if (result.attached && result.kind === "affiliate" && pathname === "/app/provider") {
              setRedirectPath("/app");
              setLoading(false);
              return;
            }
          } catch {
            // Preserve the code for a future retry; customer access itself should still work.
          }
        }
      }

      if (!mounted || seq !== accessSeqRef.current) return;
      setRedirectPath(null);
      setLoading(false);
    }

    void checkCustomerAccess();

    return () => {
      mounted = false;
    };
  }, [session?.user?.id, sessionLoading, pathname]);

  if (loading || sessionLoading) return null;
  if (redirectPath) return <Navigate to={redirectPath} replace />;

  return <>{children}</>;
}
