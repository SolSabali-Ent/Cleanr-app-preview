import { useEffect, useState } from "react";
import { UserCircle2 } from "lucide-react";
import { useProfile } from "../../lib/useProfile";
import { getSignedProfilePhotoUrl } from "../../lib/profilePhotoApi";

type ProfileNavAvatarProps = {
  size?: number;
  active?: boolean;
  activeColor?: string;
  inactiveColor?: string;
};

export function ProfileNavAvatar({
  size = 20,
  active = false,
  activeColor = "currentColor",
  inactiveColor = "currentColor",
}: ProfileNavAvatarProps) {
  const { profile } = useProfile();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void getSignedProfilePhotoUrl(profile?.profile_photo_path).then((url) => {
      if (mounted) setPhotoUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, [profile?.profile_photo_path, profile?.updated_at]);

  const color = active ? activeColor : inactiveColor;

  if (photoUrl) {
    return (
      <span
        className="inline-flex shrink-0 overflow-hidden rounded-full border"
        style={{ width: size, height: size, borderColor: color }}
      >
        <img src={photoUrl} alt="" aria-hidden className="h-full w-full object-cover" />
      </span>
    );
  }

  return <UserCircle2 size={size} strokeWidth={2.2} style={{ color }} aria-hidden />;
}
