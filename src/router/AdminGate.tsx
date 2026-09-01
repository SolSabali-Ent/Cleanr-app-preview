import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useSession } from "@/lib/useSession";

/**
 * Restricts /admin routes to users with canonical platform-admin authority.
 * Primary profile role can remain customer or CSP.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { session, loading: sessionLoading } = useSession();
  const { isAdmin, loading } = useIsAdmin();

  if (sessionLoading || loading) return null;
  if (!session?.user) return <Navigate to="/signin?reason=session-ended" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
