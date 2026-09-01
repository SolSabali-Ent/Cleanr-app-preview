import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { clearEphemeralAuthState } from "./authSession";
import type { Session } from "@supabase/supabase-js";

/**
 * Returns current Supabase session and loading state. Used by auth gates and profile hooks.
 * SIGNED_OUT also clears only ephemeral per-user auth/setup UI state; durable Cleanr truth remains in Supabase.
 */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      lastUserIdRef.current = s?.user?.id ?? null;
      setSession(s);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      const previousUserId = lastUserIdRef.current;
      const nextUserId = nextSession?.user?.id ?? null;

      if (event === "SIGNED_OUT" || (previousUserId && !nextUserId)) {
        clearEphemeralAuthState(previousUserId);
      }

      lastUserIdRef.current = nextUserId;
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
