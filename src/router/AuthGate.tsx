import { useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function AuthGate({ children }: { children?: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const hadSessionRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      if (isMounted) {
        setLoading(true);
        setProfileMissing(false);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        if (isMounted) {
          setRedirectPath(hadSessionRef.current ? "/signin?reason=session-ended" : "/signin");
          setLoading(false);
        }
        return;
      }

      hadSessionRef.current = true;

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (error || !profile) {
        if (isMounted) {
          setRedirectPath(null);
          setProfileMissing(true);
          setLoading(false);
        }
        return;
      }

      if (isMounted) {
        setRedirectPath(profile.role === "csp" ? "/csp/dashboard" : "/app");
        setProfileMissing(false);
        setLoading(false);
      }
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void checkSession();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [retryCount]);

  const handleRetry = () => {
    setRetryCount((count) => count + 1);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setRedirectPath("/signin?reason=session-ended");
    setProfileMissing(false);
  };

  if (loading) return null;
  if (profileMissing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-slate-700">We couldn't load your Cleanr profile.</p>
        <p className="max-w-sm text-xs text-slate-500">Retry the profile check. If the problem continues, sign out and sign back in.</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:opacity-90"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }
  if (redirectPath) return <Navigate to={redirectPath} replace />;

  return <>{children ?? null}</>;
}
