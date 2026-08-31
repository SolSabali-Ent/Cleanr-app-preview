import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useSession } from "./useSession";

export function useIsAdmin(): { isAdmin: boolean; loading: boolean; refresh: () => Promise<void> } {
  const { session, loading: sessionLoading } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!session?.user?.id) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.rpc("is_admin", { uid: session.user.id });
    setIsAdmin(!error && data === true);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    if (sessionLoading) return;
    void refresh();
  }, [sessionLoading, refresh]);

  return {
    isAdmin,
    loading: sessionLoading || loading,
    refresh,
  };
}
