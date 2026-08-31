import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase, isOfflinePreviewMode } from "@/lib/supabase";
import { attachRefereeByCode } from "@/lib/referralApi";
import { getStoredReferralCode, clearStoredReferralCode } from "@/lib/referralRef";

export function CustomerGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(!isOfflinePreviewMode);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    if (isOfflinePreviewMode) {
      setRedirectPath(null);
      setLoading(false);
      return;
    }

    let mounted = true;

    async function checkCustomerAccess() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        if (mounted) {
          setRedirectPath("/signin");
          setLoading(false);
        }
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (error || !profile) {
        if (mounted) {
          setRedirectPath("/signin");
          setLoading(false);
        }
        return;
      }

      const canAccessApp = profile.role === "customer" || profile.role === "admin";
      if (!canAccessApp) {
        if (mounted) {
          setRedirectPath("/dashboard");
          setLoading(false);
        }
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

      if (mounted) {
        setRedirectPath(null);
        setLoading(false);
      }
    }

    void checkCustomerAccess();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return null;
  if (redirectPath) return <Navigate to={redirectPath} replace />;

  return <>{children}</>;
}
