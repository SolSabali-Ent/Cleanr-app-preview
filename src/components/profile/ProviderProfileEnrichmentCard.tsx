import { useEffect, useState } from "react";
import { Camera, CheckCircle2, Pencil, ShieldCheck, Star, UsersRound } from "lucide-react";
import { useProfile } from "../../lib/useProfile";
import { getSignedProfilePhotoUrl, uploadMyProfilePhoto } from "../../lib/profilePhotoApi";
import { supabase } from "../../lib/supabase";
import {
  CSP_INPUT,
  CSP_PRIMARY_BUTTON,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";
import { SERVICE_RADIUS_MILES_MIN, clampServiceRadiusMiles } from "@/config/serviceArea";

type PublicSummary = {
  avg_rating: number | null;
  review_count: number | null;
  repeat_household_count: number | null;
  background_checked: boolean | null;
  insured: boolean | null;
  platform_verified: boolean | null;
};

type MetricsSummary = {
  completed_jobs: number | null;
};

function parseList(value: string): string[] {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
}

function joinList(value: string[] | null | undefined): string {
  return (value ?? []).join(", ");
}

export function ProviderProfileEnrichmentCard() {
  const { profile, refresh } = useProfile();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [publicSummary, setPublicSummary] = useState<PublicSummary | null>(null);
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [bio, setBio] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [languages, setLanguages] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [areas, setAreas] = useState("");

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name ?? profile.full_name?.trim().split(/\s+/)[0] ?? "");
    setLastName(profile.last_name ?? profile.full_name?.trim().split(/\s+/).slice(1).join(" ") ?? "");
    setPreferredName(profile.preferred_name ?? "");
    setBio(profile.provider_bio ?? "");
    setYearsExperience(profile.years_experience == null ? "" : String(profile.years_experience));
    setLanguages(joinList(profile.languages));
    setSpecialties(joinList(profile.specialties));
    setAreas(joinList(profile.service_area_labels));
    void getSignedProfilePhotoUrl(profile.profile_photo_path).then(setPhotoUrl);

    void Promise.all([
      supabase.from("provider_public_profiles").select("avg_rating,review_count,repeat_household_count,background_checked,insured,platform_verified").eq("id", profile.id).maybeSingle(),
      supabase.from("provider_metrics").select("completed_jobs").eq("id", profile.id).maybeSingle(),
    ]).then(([publicResult, metricsResult]) => {
      setPublicSummary((publicResult.data as PublicSummary | null) ?? null);
      setMetrics((metricsResult.data as MetricsSummary | null) ?? null);
    });
  }, [profile?.id, profile?.updated_at, profile?.profile_photo_path]);

  if (!profile) return null;

  const displayName = profile.preferred_name?.trim() || profile.full_name?.trim() || "Cleaning Service Professional";
  const photoMissing = !profile.profile_photo_path?.trim();
  const completeFields = [
    !photoMissing,
    Boolean(profile.first_name?.trim()),
    Boolean(profile.last_name?.trim()),
    Boolean(profile.provider_bio?.trim()),
    (profile.languages?.length ?? 0) > 0,
    (profile.specialties?.length ?? 0) > 0,
  ].filter(Boolean).length;

  async function handlePhoto(file: File | null) {
    const currentProfile = profile;
    if (!file || !currentProfile) return;
    setPhotoBusy(true);
    setMessage(null);
    try {
      const path = await uploadMyProfilePhoto(file, currentProfile.id);
      await refresh();
      setPhotoUrl(await getSignedProfilePhotoUrl(path));
      setMessage("Profile photo updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update profile photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleSave() {
    const currentProfile = profile;
    if (!currentProfile) return;
    setSaving(true);
    setMessage(null);
    const radius = clampServiceRadiusMiles(currentProfile.service_radius_miles ?? SERVICE_RADIUS_MILES_MIN) ?? SERVICE_RADIUS_MILES_MIN;
    const experience = yearsExperience.trim() === "" ? null : Number(yearsExperience);
    const normalizedExperience = experience !== null && Number.isFinite(experience) ? experience : null;
    const { error } = await supabase.rpc("update_my_provider_profile_enrichment", {
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_phone: currentProfile.phone?.trim() || null,
      p_zip: currentProfile.zip_code?.trim() || null,
      p_service_radius_miles: radius,
      p_preferred_name: preferredName.trim() || null,
      p_provider_bio: bio.trim() || null,
      p_years_experience: normalizedExperience,
      p_languages: parseList(languages),
      p_specialties: parseList(specialties),
      p_service_area_labels: parseList(areas),
    });
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await refresh();
    setEditing(false);
    setMessage("Customer-facing profile updated.");
  }

  return (
    <section className="mb-7">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: CSP_TEXT_SECONDARY }}>Your profile</p>
          <h1 className="mt-1 text-xl font-semibold" style={{ color: CSP_TEXT_PRIMARY }}>What households see</h1>
          <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Help people know who is coming into their home.</p>
        </div>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex shrink-0 items-center gap-1.5 pb-0.5 text-xs font-semibold text-white">
            <Pencil size={14} /> Edit
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-start gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/5">
            {photoUrl ? <img src={photoUrl} alt={`${displayName} profile`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white/70">{displayName.charAt(0)}</div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold" style={{ color: CSP_TEXT_PRIMARY }}>{displayName}</p>
              {photoMissing ? (
                <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Photo needed</span>
              ) : (
                <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">Photo ready</span>
              )}
            </div>
            <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{completeFields}/6 trust details complete</p>
            {profile.provider_bio ? <p className="mt-2 line-clamp-3 text-sm leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{profile.provider_bio}</p> : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-white">
            <Camera size={15} /> {photoBusy ? "Updating…" : photoUrl ? "Change photo" : "Add photo"}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={photoBusy} onChange={(event) => void handlePhoto(event.target.files?.[0] ?? null)} />
          </label>
          <span className="text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>Required for new marketplace activation.</span>
        </div>

        <div className="mt-4 grid grid-cols-3 border-t border-white/10 pt-4 text-center">
          <div className="border-r border-white/10 px-2">
            <p className="text-base font-semibold">{metrics?.completed_jobs ?? 0}</p>
            <p className="mt-1 text-[10px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>Completed</p>
          </div>
          <div className="border-r border-white/10 px-2">
            <p className="text-base font-semibold">{publicSummary?.repeat_household_count ?? 0}</p>
            <p className="mt-1 text-[10px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>Repeat homes</p>
          </div>
          <div className="px-2">
            <p className="inline-flex items-center gap-1 text-base font-semibold"><Star size={13} />{publicSummary?.avg_rating ?? "—"}</p>
            <p className="mt-1 text-[10px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>{publicSummary?.review_count ?? 0} reviews</p>
          </div>
        </div>

        {(publicSummary?.background_checked || publicSummary?.insured || publicSummary?.platform_verified || (publicSummary?.repeat_household_count ?? 0) > 0) ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            {publicSummary?.background_checked ? <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}><ShieldCheck size={12} /> Background checked</span> : null}
            {publicSummary?.insured ? <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}><ShieldCheck size={12} /> Insured</span> : null}
            {publicSummary?.platform_verified ? <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}><CheckCircle2 size={12} /> Cleanr verified</span> : null}
            {(publicSummary?.repeat_household_count ?? 0) > 0 ? <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}><UsersRound size={12} /> Repeat relationships</span> : null}
          </div>
        ) : null}

        {editing ? (
          <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 w-full rounded-xl border-0 text-white" style={{ backgroundColor: CSP_INPUT, padding: "11px 12px" }} /></label>
              <label className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 w-full rounded-xl border-0 text-white" style={{ backgroundColor: CSP_INPUT, padding: "11px 12px" }} /></label>
            </div>
            <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Preferred name <span className="opacity-70">(optional)</span><input value={preferredName} onChange={(e) => setPreferredName(e.target.value)} className="mt-1 w-full rounded-xl border-0 text-white" style={{ backgroundColor: CSP_INPUT, padding: "11px 12px" }} /></label>
            <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>A little about me<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={800} rows={4} placeholder="What should a household know about how you work and what you care about?" className="mt-1 w-full resize-none rounded-xl border-0 text-white" style={{ backgroundColor: CSP_INPUT, padding: "11px 12px" }} /></label>
            <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Years of cleaning experience<input type="number" min={0} max={80} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} className="mt-1 w-full rounded-xl border-0 text-white" style={{ backgroundColor: CSP_INPUT, padding: "11px 12px" }} /></label>
            <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Languages <span className="opacity-70">(comma separated)</span><input value={languages} onChange={(e) => setLanguages(e.target.value)} placeholder="English, Spanish" className="mt-1 w-full rounded-xl border-0 text-white" style={{ backgroundColor: CSP_INPUT, padding: "11px 12px" }} /></label>
            <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Cleaning strengths <span className="opacity-70">(comma separated)</span><input value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="Deep cleans, kitchens, pet-friendly homes" className="mt-1 w-full rounded-xl border-0 text-white" style={{ backgroundColor: CSP_INPUT, padding: "11px 12px" }} /></label>
            <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Areas I serve <span className="opacity-70">(display only)</span><input value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Decatur, East Atlanta, Kirkwood" className="mt-1 w-full rounded-xl border-0 text-white" style={{ backgroundColor: CSP_INPUT, padding: "11px 12px" }} /><span className="mt-1 block text-[10px] opacity-70">Actual job eligibility still uses your ZIP + service radius.</span></label>
            {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={() => void handleSave()} className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>{saving ? "Saving…" : "Save profile"}</button>
              <button type="button" disabled={saving} onClick={() => setEditing(false)} className="rounded-xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: CSP_INPUT, color: CSP_TEXT_PRIMARY }}>Cancel</button>
            </div>
          </div>
        ) : message ? <p className="mt-3 text-xs text-emerald-300">{message}</p> : null}
      </div>
    </section>
  );
}
