import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { attachRefereeByCode } from "@/lib/referralApi";
import { getStoredReferralCode, clearStoredReferralCode } from "@/lib/referralRef";

export function CustomerGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
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

      if (mounted) {
        const canAccessApp = profile.role === "customer" || profile.role === "admin";
        setRedirectPath(canAccessApp ? null : "/dashboard");
        setLoading(false);
      }
    }

    checkCustomerAccess();

    return () => {
      mounted = false;
    };
  }, []);

  // One-time referral attach: if user landed with ?ref= and is now customer, attach then clear.
  useEffect(() => {
    if (loading || redirectPath !== null) return;
    const code = getStoredReferralCode();
    if (!code) return;
    clearStoredReferralCode();
    attachRefereeByCode(code).catch(() => {}).finally(() => {
      clearStoredReferralCode();
    });
  }, [loading, redirectPath]);

  if (loading) return null;
  if (redirectPath) return <Navigate to={redirectPath} replace />;

  return <>{children}</>;
}
