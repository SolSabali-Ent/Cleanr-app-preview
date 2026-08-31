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
    const { data, error } = await supabase.rpc("is_admin", { uid: userId });
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
