import { useEffect, useState } from "react";
import { Camera, CreditCard, HelpCircle, LogOut, MapPin, Pencil, Share2, Zap } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useProfile } from "@/lib/useProfile";
import { useSession } from "@/lib/useSession";
import { signOutCleanr } from "@/lib/authSession";
import { customerRouteForContext } from "@/lib/contextualRoutes";
import { getSignedProfilePhotoUrl, removeMyProfilePhoto, uploadMyProfilePhoto } from "@/lib/profilePhotoApi";
import { supabase } from "@/lib/supabase";
import { Button } from "../../components/ui/Button";
import { CustomerHouseholdMemoryCard } from "../components/CustomerHouseholdMemoryCard";

const COMMUNICATION_OPTIONS = [
  ["app_message", "Cleanr messages"],
  ["text", "Text"],
  ["phone", "Phone call"],
  ["email", "Email"],
  ["no_preference", "No preference"],
] as const;

export function CustomerProfile() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { session } = useSession();
  const { profile, loading: profileLoading, refresh } = useProfile();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [communication, setCommunication] = useState("");
  const [homePriority, setHomePriority] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name ?? profile.full_name?.trim().split(/\s+/)[0] ?? "");
    setLastName(profile.last_name ?? profile.full_name?.trim().split(/\s+/).slice(1).join(" ") ?? "");
    setPreferredName(profile.preferred_name ?? "");
    setCommunication(profile.preferred_communication ?? "");
    setHomePriority(profile.customer_home_priority ?? "");
    void getSignedProfilePhotoUrl(profile.profile_photo_path).then(setPhotoUrl);
  }, [profile?.id, profile?.updated_at, profile?.profile_photo_path]);

  const email = session?.user.email ?? null;
  const name = profile?.full_name?.trim() || email?.split("@")[0] || "Cleanr customer";
  const phone = profile?.phone?.trim() || null;
  const preferredDisplayName = profile?.preferred_name?.trim() || name;
  const initial = preferredDisplayName.charAt(0).toUpperCase() || "C";

  const actionRowClass = "w-full flex items-center justify-between px-3 py-3 text-left hover:bg-[#F3FAF1]/50 rounded-lg transition";
  const route = (canonicalPath: string) => customerRouteForContext(pathname, canonicalPath);

  const handlePhoto = async (file: File | null) => {
    if (!file || !profile?.id) return;
    setPhotoBusy(true);
    setMessage(null);
    try {
      const path = await uploadMyProfilePhoto(file, profile.id);
      await refresh();
      setPhotoUrl(await getSignedProfilePhotoUrl(path));
      setMessage("Profile photo updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update profile photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!profile?.profile_photo_path) return;
    setPhotoBusy(true);
    setMessage(null);
    try {
      await removeMyProfilePhoto(profile.profile_photo_path);
      await refresh();
      setPhotoUrl(null);
      setMessage("Profile photo removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove profile photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase.rpc("update_my_customer_profile", {
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_preferred_name: preferredName.trim() || null,
      p_preferred_communication: communication || null,
      p_customer_home_priority: homePriority.trim() || null,
    });
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refresh();
    setEditing(false);
    setMessage("Profile updated.");
  };

  const handleLogout = async () => {
    setLogoutError(null);
    setLogoutLoading(true);
    try {
      await signOutCleanr();
      navigate("/", { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Could not sign out. Please try again.");
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div className="text-[#0B1220]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Profile</h1>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#166534]">
            <Pencil className="h-4 w-4" /> Edit
          </button>
        ) : null}
      </div>

      {message ? <div className="mb-3 rounded-xl border border-[#DCEED7] bg-[#F3FAF1] px-3 py-2 text-sm text-[#166534]">{message}</div> : null}

      <section className="provider-card mb-4">
        <div className="flex gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[#DCEED7] bg-[#F3FAF1]">
            {photoUrl ? <img src={photoUrl} alt={`${preferredDisplayName} profile`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-[#166534]">{profileLoading ? "…" : initial}</div>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">{profileLoading ? "Loading profile…" : name}</p>
            {profile?.preferred_name ? <p className="text-xs text-[#667085]">Goes by {profile.preferred_name}</p> : null}
            {email ? <p className="mt-1 text-xs text-[#667085] break-all">{email}</p> : null}
            {phone ? <p className="text-xs text-[#667085]">{phone}</p> : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#DCEED7] bg-white px-3 py-2 text-xs font-semibold text-[#166534]">
            <Camera className="h-4 w-4" /> {photoBusy ? "Updating…" : photoUrl ? "Change photo" : "Add photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={photoBusy} onChange={(event) => void handlePhoto(event.target.files?.[0] ?? null)} />
          </label>
          {photoUrl ? <button type="button" disabled={photoBusy} onClick={() => void handleRemovePhoto()} className="rounded-lg px-3 py-2 text-xs font-medium text-[#667085] disabled:opacity-50">Remove</button> : null}
        </div>
        <p className="mt-2 text-[11px] leading-4 text-[#667085]">Optional. Your photo is only available to Cleanr, you, and CSPs who are actually serving or connected to your household.</p>
      </section>

      {editing ? (
        <section className="provider-card mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-[#667085]">First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#0B1220]" /></label>
            <label className="text-xs font-semibold text-[#667085]">Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#0B1220]" /></label>
          </div>
          <label className="block text-xs font-semibold text-[#667085]">Preferred name <span className="font-normal">(optional)</span><input value={preferredName} onChange={(e) => setPreferredName(e.target.value)} placeholder="What should your CSP call you?" className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#0B1220]" /></label>
          <label className="block text-xs font-semibold text-[#667085]">Communication preference<select value={communication} onChange={(e) => setCommunication(e.target.value)} className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#0B1220]"><option value="">Choose one</option>{COMMUNICATION_OPTIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="block text-xs font-semibold text-[#667085]">What matters most in your home? <span className="font-normal">(optional)</span><textarea value={homePriority} onChange={(e) => setHomePriority(e.target.value)} maxLength={600} rows={3} placeholder="Example: Please be extra careful around the nursery and focus on kitchen floors." className="mt-1 w-full resize-none rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#0B1220]" /></label>
          <p className="text-[11px] leading-4 text-[#667085]">Keep this focused on service context. Saved household memory remains separately controlled below.</p>
          <div className="flex gap-2">
            <Button variant="primaryGreen" size="md" onClick={() => void handleSaveProfile()} disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
            <Button variant="secondary" size="md" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
          </div>
        </section>
      ) : (
        <section className="provider-card mb-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#166534]">How to work well with me</p>
          <div className="space-y-2 text-sm">
            <p><span className="text-[#667085]">Preferred communication:</span> <span className="font-medium">{COMMUNICATION_OPTIONS.find(([value]) => value === profile?.preferred_communication)?.[1] ?? "Not set"}</span></p>
            <div><p className="text-[#667085]">What matters most in my home:</p><p className="mt-1 leading-5">{profile?.customer_home_priority || "Not set yet."}</p></div>
          </div>
        </section>
      )}

      <CustomerHouseholdMemoryCard />

      <section className="provider-card p-1 mb-3">
        <button type="button" onClick={() => navigate(route("/app/payments"))} className={actionRowClass}><div className="flex items-center gap-3"><CreditCard className="w-4 h-4 text-[#8DCC64]" /><div><p className="text-sm">Payment methods</p><p className="text-xs text-[#667085]">Saved cards and your default payment</p></div></div></button>
        <div className="h-px bg-[#E5E7EB] mx-3" />
        <button type="button" onClick={() => navigate(route("/app/addresses"))} className={actionRowClass}><div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-[#8DCC64]" /><div><p className="text-sm">Your places</p><p className="text-xs text-[#667085]">Homes you can book and pay for</p></div></div></button>
      </section>

      <section className="provider-card p-1 mb-3">
        <button type="button" onClick={() => navigate("/book?priority=urgent")} className={actionRowClass}><div className="flex items-center gap-3"><Zap className="w-4 h-4 text-[#B45309]" /><div><div className="flex items-center gap-2"><p className="text-sm font-medium">Priority cleaning</p><span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#92400E]">Short notice</span></div><p className="text-xs text-[#667085]">Need a cleaning sooner? Check priority availability.</p></div></div></button>
        <div className="h-px bg-[#E5E7EB] mx-3" />
        <button type="button" onClick={() => navigate(route("/app/affiliate"))} className={actionRowClass}><div className="flex items-center gap-3"><Share2 className="w-4 h-4 text-[#8DCC64]" /><div><p className="text-sm">Share &amp; earn</p><p className="text-xs text-[#667085]">Your referral link, activity, and rewards</p></div></div></button>
        <div className="h-px bg-[#E5E7EB] mx-3" />
        <button type="button" onClick={() => navigate(route("/app/support"))} className={actionRowClass}><div className="flex items-center gap-3"><HelpCircle className="w-4 h-4 text-[#8DCC64]" /><div><p className="text-sm">Help &amp; safety</p><p className="text-xs text-[#667085]">Booking help, policies, and active-cleaning support</p></div></div></button>
      </section>

      {logoutError ? <p className="mb-2 text-sm text-red-600" role="alert">{logoutError}</p> : null}

      <Button className="mt-2" variant="secondary" size="lg" fullWidth leftIcon={<LogOut className="w-3 h-3" />} onClick={handleLogout} disabled={logoutLoading} loading={logoutLoading}>
        {logoutLoading ? "Signing out…" : "Log out"}
      </Button>
    </div>
  );
}
