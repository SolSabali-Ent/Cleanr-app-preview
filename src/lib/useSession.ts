import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Session } from "@supabase/supabase-js";

/**
 * Returns current Supabase session and loading state. Used by auth gates and profile hooks.
 */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}
