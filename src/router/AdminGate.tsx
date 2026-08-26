import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * Restricts /admin routes to users with profiles.role = 'admin'.
 * Non-admin users are redirected to /dashboard (which sends them to /app or /csp/dashboard by role).
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || !mounted) {
        if (mounted) setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      if (mounted) {
        setIsAdmin(profile?.role === "admin");
        setLoading(false);
      }
    }

    checkAdmin();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      checkAdmin();
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
