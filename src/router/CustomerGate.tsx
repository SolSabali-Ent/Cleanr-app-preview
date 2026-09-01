import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase, isOfflinePreviewMode } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { attachRefereeByCode } from "@/lib/referralApi";
import { getStoredReferralCode, clearStoredReferralCode } from "@/lib/referralRef";

export function CustomerGate({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
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

      // Resolve a stored invitation before mounting customer children. This is important for
      // existing-client invitations because ProviderContext should see the durable relationship
      // on its first read rather than briefly rendering booking-only/no-relationship state.
      if (profile.role === "customer") {
        const code = getStoredReferralCode();
        if (code) {
          try {
            const result = await attachRefereeByCode(code);
            // A completed or definitively invalid/consumed code should not replay. On transport
            // or server errors, leave the code stored so the customer can retry on a later entry.
            if (result.attached || result.attached === false) {
              clearStoredReferralCode();
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
  }, [session?.user?.id, sessionLoading]);

  if (loading || sessionLoading) return null;
  if (redirectPath) return <Navigate to={redirectPath} replace />;

  return <>{children}</>;
}
