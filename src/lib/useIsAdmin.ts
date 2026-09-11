import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useSession } from "./useSession";

export function useIsAdmin(): {
  isAdmin: boolean;
  loading: boolean;
  userId: string | null;
  refresh: () => Promise<void>;
} {
  const { session, loading: sessionLoading } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const userId = session?.user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    // This self-only RPC answers whether the signed-in account has platform
    // authority. Privileged database actions use is_admin(), which separately
    // requires an AAL2 (MFA) session.
    const { data, error } = await supabase.rpc("has_platform_admin_authority_self");
    setIsAdmin(!error && data === true);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (sessionLoading) return;
    void refresh();
  }, [sessionLoading, refresh]);

  return {
    isAdmin,
    loading: sessionLoading || loading,
    userId,
    refresh,
  };
}
