import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useProfile } from "../../../lib/useProfile";
import { supabase } from "../../../lib/supabase";
import BottomSheet, { type Snap } from "../../../components/ui/BottomSheet";
import Toggle from "../../../components/ui/Toggle";
import { ContinuumParticipationCard } from "../../../components/continuum/ContinuumParticipationCard";
import {
  CSP_BACKGROUND,
  CSP_INPUT,
  CSP_PRIMARY_BUTTON,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";
import {
  SERVICE_RADIUS_MILES_MIN,
  SERVICE_RADIUS_MILES_MAX,
  clampServiceRadiusMiles,
  isValidServiceRadiusMiles,
} from "@/config/serviceArea";
import { traceProfileWriteStart, traceProfileWriteResult } from "@/lib/debug/profileWriteTrace";

type ProviderPreferences = {
  provider_id: string;
  accepts_new_marketplace_work: boolean;
  accepts_recurring: boolean;
  accepts_premium: boolean;
  max_jobs_per_day: number;
  preferred_arrival_windows: string[];
  preferred_service_types: string[];
  updated_at: string;
};

function defaultPreferences(providerId: string): ProviderPreferences {
  return {
    provider_id: providerId,
    accepts_new_marketplace_work: true,
    accepts_recurring: true,
    accepts_premium: true,
    max_jobs_per_day: 3,
    preferred_arrival_windows: [],
    preferred_service_types: [],
    updated_at: new Date().toISOString(),
  };
}

function SettingRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 border-b border-white/10 py-4 text-left last:border-b-0"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: CSP_TEXT_PRIMARY }}>{label}</p>
        <p className="mt-1 truncate text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{value}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: CSP_TEXT_SECONDARY }} />
    </button>
  );
}

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { profile, refresh } = useProfile();
  const [editingArea, setEditingArea] = useState(false);
  const [savingArea, setSavingArea] = useState(false);
  const [workSettingsOpen, setWorkSettingsOpen] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<Snap>("medium");
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferences, setPreferences] = useState<ProviderPreferences | null>(null);
  const [draftPreferences, setDraftPreferences] = useState<ProviderPreferences | null>(null);
  const [scheduleSummaryLoading, setScheduleSummaryLoading] = useState(true);
  const [hasWeeklyAvailability, setHasWeeklyAvailability] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [zip, setZip] = useState(profile?.zip_code ?? "");
  const [radius, setRadius] = useState(clampServiceRadiusMiles(profile?.service_radius_miles ?? 10) ?? 10);

  const loadPreferences = useCallback(async () => {
    if (!profile?.id) return;
    setPreferencesLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      setPreferencesLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("provider_preferences")
      .select("*")
      .eq("provider_id", user.id)
      .maybeSingle();

    if (!error && data) {
      const row = data as Partial<ProviderPreferences> & { provider_id: string };
      const normalized: ProviderPreferences = {
        ...defaultPreferences(row.provider_id),
        ...row,
        accepts_new_marketplace_work: row.accepts_new_marketplace_work !== false,
      };
      setPreferences(normalized);
      setDraftPreferences(normalized);
    } else {
      const fallback = defaultPreferences(profile.id);
      setPreferences(fallback);
      setDraftPreferences(fallback);
    }
    setPreferencesLoading(false);
  }, [profile?.id]);

  const loadScheduleSummary = useCallback(async () => {
    if (!profile?.id) return;
    setScheduleSummaryLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      setScheduleSummaryLoading(false);
      return;
    }

    const { count, error } = await supabase
      .from("provider_availability_blocks")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", user.id)
      .eq("active", true);

    setHasWeeklyAvailability(!error && (count ?? 0) > 0);
    setScheduleSummaryLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    void loadPreferences();
    void loadScheduleSummary();
  }, [loadPreferences, loadScheduleSummary]);

  if (!profile) return null;
  const currentProfile = profile;

  const applicationApproved = (currentProfile.application_status ?? "").toLowerCase() === "approved";
  const payoutReady = currentProfile.stripe_connect_ready === true && Boolean(currentProfile.stripe_connect_account_id?.trim());
  const verificationSummary = applicationApproved
    ? "Application approved"
    : currentProfile.application_status
      ? `Application ${currentProfile.application_status.replaceAll("_", " ")}`
      : "Application not started";
  const payoutSummary = payoutReady
    ? "Stripe connected"
    : applicationApproved
      ? "Stripe setup required"
      : "Available after approval";
  const workSummary = preferencesLoading
    ? "Loading…"
    : `${preferences?.accepts_new_marketplace_work === false ? "New work paused" : "New work on"} · ${preferences?.accepts_recurring ? "Recurring on" : "Recurring off"} · ${preferences?.max_jobs_per_day ?? 3}/day`;
  const scheduleSummary = scheduleSummaryLoading
    ? "Loading…"
    : hasWeeklyAvailability
      ? "Weekly availability set"
      : "Weekly availability not set";

  async function handleSaveArea() {
    const clampedRadius = clampServiceRadiusMiles(radius) ?? SERVICE_RADIUS_MILES_MIN;
    if (!isValidServiceRadiusMiles(radius)) {
      setToast(`Service radius must be between ${SERVICE_RADIUS_MILES_MIN} and ${SERVICE_RADIUS_MILES_MAX} miles.`);
      return;
    }

    setSavingArea(true);
    const durableName = currentProfile.full_name?.trim() || [currentProfile.first_name, currentProfile.last_name].filter(Boolean).join(" ").trim();
    const rpcArgs = {
      p_full_name: durableName,
      p_phone: currentProfile.phone?.trim() || null,
      p_zip: zip.trim(),
      p_service_radius_miles: clampedRadius,
    };
    const traceRpc = await traceProfileWriteStart({
      source: "ProfileScreen.handleSave:update_provider_profile_self_service",
      operation: "rpc",
      targetId: currentProfile.id,
      payload: rpcArgs,
      pathname: "/csp/dashboard/profile",
      cspFlowState: {
        is_onboarded: currentProfile.is_onboarded,
        application_status: currentProfile.application_status,
      },
    });
    const rpcResult = await supabase.rpc("update_provider_profile_self_service", rpcArgs);
    traceProfileWriteResult(traceRpc, rpcResult);
    setSavingArea(false);

    if (rpcResult.error) {
      setToast("Could not update service area.");
      return;
    }
    await refresh();
    setEditingArea(false);
    setToast("Service area updated");
    window.setTimeout(() => setToast(null), 2200);
  }

  async function handleSavePreferences() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id || !draftPreferences) return;

    const safeMaxJobs = Number.isFinite(draftPreferences.max_jobs_per_day)
      ? Math.max(1, Math.min(20, Math.round(draftPreferences.max_jobs_per_day)))
      : 3;

    setPreferencesSaving(true);
    const { error } = await supabase.from("provider_preferences").upsert({
      provider_id: user.id,
      accepts_new_marketplace_work: draftPreferences.accepts_new_marketplace_work,
      accepts_recurring: draftPreferences.accepts_recurring,
      accepts_premium: draftPreferences.accepts_premium,
      max_jobs_per_day: safeMaxJobs,
      updated_at: new Date().toISOString(),
    });
    setPreferencesSaving(false);

    if (error) {
      setToast("Work settings could not be updated.");
      return;
    }

    await loadPreferences();
    setWorkSettingsOpen(false);
    setToast(draftPreferences.accepts_new_marketplace_work ? "New marketplace opportunities are on" : "New marketplace opportunities paused");
    window.setTimeout(() => setToast(null), 2200);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen px-4 pb-24 pt-2" style={{ backgroundColor: CSP_BACKGROUND, color: CSP_TEXT_PRIMARY }}>
      {toast ? (
        <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">{toast}</div>
      ) : null}

      <section className="mb-7">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Service settings</h2>
            <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>The practical settings that control how you work.</p>
          </div>
        </div>

        <div className="border-y border-white/10">
          <SettingRow
            label="Service area"
            value={currentProfile.zip_code ? `ZIP ${currentProfile.zip_code} · ${currentProfile.service_radius_miles ?? radius} mi radius` : "Not set"}
            onClick={() => {
              setZip(currentProfile.zip_code ?? "");
              setRadius(clampServiceRadiusMiles(currentProfile.service_radius_miles ?? 10) ?? 10);
              setEditingArea(true);
            }}
          />
          <SettingRow
            label="Work preferences"
            value={workSummary}
            onClick={() => {
              setDraftPreferences(preferences ?? defaultPreferences(currentProfile.id));
              setSheetSnap("medium");
              setWorkSettingsOpen(true);
            }}
          />
          <SettingRow label="Calendar & availability" value={scheduleSummary} onClick={() => navigate("/csp/dashboard/calendar")} />
          <SettingRow label="Verification" value={verificationSummary} onClick={() => navigate("/csp/dashboard/application-status")} />
          <SettingRow label="Payouts" value={payoutSummary} onClick={() => navigate("/csp/dashboard/application/payout-setup")} />
        </div>
      </section>

      {editingArea ? (
        <section className="mb-7 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Edit service area</h3>
            <button type="button" className="text-xs" style={{ color: CSP_TEXT_SECONDARY }} onClick={() => setEditingArea(false)}>Cancel</button>
          </div>
          <div className="space-y-3">
            <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
              ZIP code
              <input
                type="text"
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-white/10 px-3 py-3 text-white outline-none"
                style={{ backgroundColor: CSP_INPUT }}
              />
            </label>
            <label className="block text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
              Service radius
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={SERVICE_RADIUS_MILES_MIN}
                  max={SERVICE_RADIUS_MILES_MAX}
                  value={radius}
                  onChange={(e) => setRadius(clampServiceRadiusMiles(Number(e.target.value)) ?? SERVICE_RADIUS_MILES_MIN)}
                  className="flex-1 accent-[#0A84FF]"
                />
                <span className="w-14 text-right text-sm font-semibold">{radius} mi</span>
              </div>
            </label>
            <button type="button" onClick={() => void handleSaveArea()} disabled={savingArea} className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
              {savingArea ? "Saving…" : "Save service area"}
            </button>
          </div>
        </section>
      ) : null}

      <details className="mb-7 border-y border-white/10 py-4">
        <summary className="cursor-pointer list-none text-sm font-semibold">How I participate beyond cleaning</summary>
        <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Optional roles and ways you may contribute over time.</p>
        <div className="mt-4"><ContinuumParticipationCard /></div>
      </details>

      <button type="button" onClick={() => void handleSignOut()} className="w-full py-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Sign out</button>

      <BottomSheet open={workSettingsOpen} onClose={() => setWorkSettingsOpen(false)} snap={sheetSnap} setSnap={setSheetSnap} title="Work preferences" subtitle="Choose the kinds and amount of work that fit your practice." tone="dark">
        <div className="space-y-5 px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="pr-4">
              <p className="text-sm font-semibold text-white">New marketplace opportunities</p>
              <p className="mt-1 text-xs leading-5 text-white/60">Turn off to stop receiving new marketplace work. Existing household relationships and booked visits stay intact.</p>
            </div>
            <Toggle checked={draftPreferences?.accepts_new_marketplace_work !== false} onChange={(val) => setDraftPreferences((prev) => prev ? { ...prev, accepts_new_marketplace_work: val } : prev)} disabled={preferencesSaving} tone="dark" />
          </div>
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="pr-4"><p className="text-sm font-semibold text-white">Recurring clients</p><p className="mt-1 text-xs text-white/60">Allow repeat maintenance bookings.</p></div>
            <Toggle checked={Boolean(draftPreferences?.accepts_recurring)} onChange={(val) => setDraftPreferences((prev) => prev ? { ...prev, accepts_recurring: val } : prev)} disabled={preferencesSaving} tone="dark" />
          </div>
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="pr-4"><p className="text-sm font-semibold text-white">Premium bookings</p><p className="mt-1 text-xs text-white/60">Allow higher-value eligible booking types.</p></div>
            <Toggle checked={Boolean(draftPreferences?.accepts_premium)} onChange={(val) => setDraftPreferences((prev) => prev ? { ...prev, accepts_premium: val } : prev)} disabled={preferencesSaving} tone="dark" />
          </div>
          <label className="block text-sm font-semibold text-white">
            Max jobs per day
            <input type="number" min={1} max={20} value={draftPreferences?.max_jobs_per_day ?? 3} onChange={(e) => setDraftPreferences((prev) => prev ? { ...prev, max_jobs_per_day: Number(e.target.value) } : prev)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-white outline-none" />
          </label>
          <button type="button" onClick={() => void handleSavePreferences()} disabled={preferencesSaving} className="w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>
            {preferencesSaving ? "Saving…" : "Save work preferences"}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
