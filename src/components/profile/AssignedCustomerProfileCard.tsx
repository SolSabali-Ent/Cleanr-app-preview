import { useEffect, useState } from "react";
import { MessageCircle, UserRound } from "lucide-react";
import { getAssignedBookingCustomerProfile, getSignedProfilePhotoUrl, type AssignedCustomerProfile } from "../../lib/profilePhotoApi";

function communicationLabel(value: string | null): string | null {
  if (value === "app_message") return "Cleanr messages";
  if (value === "text") return "Text";
  if (value === "phone") return "Phone call";
  if (value === "email") return "Email";
  if (value === "no_preference") return "No preference";
  return null;
}

export function AssignedCustomerProfileCard({ bookingId }: { bookingId: string }) {
  const [profile, setProfile] = useState<AssignedCustomerProfile | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getAssignedBookingCustomerProfile(bookingId).then(async (next) => {
      if (!active) return;
      setProfile(next);
      if (next?.profile_photo_path) {
        const signed = await getSignedProfilePhotoUrl(next.profile_photo_path);
        if (active) setPhotoUrl(signed);
      } else {
        setPhotoUrl(null);
      }
    });
    return () => { active = false; };
  }, [bookingId]);

  if (!profile) return null;

  const fullName = profile.full_name?.trim() || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Customer";
  const displayName = profile.preferred_name?.trim() || profile.first_name?.trim() || fullName;
  const comm = communicationLabel(profile.preferred_communication);

  return (
    <section className="mb-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 shadow-md">
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-sky-200 bg-white">
          {photoUrl ? <img src={photoUrl} alt={`${displayName} profile`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-sky-700"><UserRound size={22} /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Household contact</p>
          <p className="mt-0.5 text-base font-semibold text-slate-950">{fullName}</p>
          {profile.preferred_name ? <p className="text-xs text-slate-600">Goes by {profile.preferred_name}</p> : null}
          {comm ? <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-600"><MessageCircle size={13} /> Prefers {comm.toLowerCase()}</p> : null}
        </div>
      </div>
      {profile.what_matters_most ? (
        <div className="mt-3 rounded-xl border border-sky-100 bg-white/70 p-3">
          <p className="text-[11px] font-semibold text-sky-800">What matters most in this home</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-slate-700">{profile.what_matters_most}</p>
        </div>
      ) : null}
      <p className="mt-2 text-[10px] leading-4 text-slate-500">Shown because you are assigned to this household. This profile does not expose the customer’s email, phone number, or unrelated personal information.</p>
    </section>
  );
}
