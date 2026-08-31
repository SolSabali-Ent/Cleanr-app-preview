import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useIsAdmin } from "@/lib/useIsAdmin";

/**
 * Restricts /admin routes to users with canonical platform-admin authority.
 * Primary profile role can remain customer or CSP.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useIsAdmin();

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
