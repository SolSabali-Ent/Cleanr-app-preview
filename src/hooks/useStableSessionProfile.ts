import { useEffect, useRef, useState } from "react";
import { useProfile, type Profile } from "@/lib/useProfile";
import { useSession } from "@/lib/useSession";

/**
 * Keeps the last resolved profile for the signed-in user so brief `useProfile` reloads
 * do not drop downstream UI to a blocking state.
 */
export function useStableSessionProfile() {
  const { profile, loading: profileLoading } = useProfile();
  const { session, loading: sessionLoading } = useSession();
  const [stableProfile, setStableProfile] = useState<Profile | null>(null);
  const prevSessionUidRef = useRef<string | null>(null);

  const sessionUid = session?.user?.id ?? null;

  useEffect(() => {
    if (!sessionUid) {
      setStableProfile(null);
      prevSessionUidRef.current = null;
      return;
    }
    if (prevSessionUidRef.current !== null && prevSessionUidRef.current !== sessionUid) {
      setStableProfile(null);
    }
    prevSessionUidRef.current = sessionUid;
  }, [sessionUid]);

  const profileFreshReady =
    !sessionLoading && !profileLoading && Boolean(sessionUid && profile && profile.id === sessionUid);

  useEffect(() => {
    if (!profileFreshReady || !profile || profile.id !== sessionUid) return;
    setStableProfile(profile);
  }, [profileFreshReady, profile, sessionUid]);

  const stableOk = Boolean(stableProfile && sessionUid && stableProfile.id === sessionUid);

  const displayProfile: Profile | null = stableOk
    ? stableProfile
    : profileFreshReady && profile && profile.id === sessionUid
      ? profile
      : null;

  const showInitialBlocking =
    !stableOk &&
    (sessionLoading || !sessionUid || profileLoading || !profile || profile.id !== sessionUid);

  return {
    sessionUid,
    sessionLoading,
    profileLoading,
    displayProfile,
    stableOk,
    showInitialBlocking,
    profileFreshReady,
  };
}
