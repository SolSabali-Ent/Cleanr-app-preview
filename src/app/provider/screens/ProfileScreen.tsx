import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfile } from "../../../lib/useProfile";
import { supabase } from "../../../lib/supabase";
import { createReferral } from "../../../lib/referralApi";
import BottomSheet, { type Snap } from "../../../components/ui/BottomSheet";
import Toggle from "../../../components/ui/Toggle";
import { Share2 } from "lucide-react";
import {
  CSP_BACKGROUND,
  CSP_SURFACE,
  CSP_INPUT,
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SECTION_GAP,
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
  accepts_recurring: boolean;
  accepts_premium: boolean;
  max_jobs_per_day: number;
  preferred_arrival_windows: string[];
  preferred_service_types: string[];
  updated_at: string;
};

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { profile, refresh } = useProfile();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workSettingsOpen, setWorkSettingsOpen] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<Snap>("medium");
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [scheduleSummaryLoading, setScheduleSummaryLoading] = useState(true);
  const [hasWeeklyAvailability, setHasWeeklyAvailability] = useState(false);
  const [scheduleSummaryError, setScheduleSummaryError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ProviderPreferences | null>(null);
  const [draftPreferences, setDraftPreferences] = useState<ProviderPreferences | null>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [zip, setZip] = useState(profile?.zip_code ?? "");
  const [radius, setRadius] = useState(
    clampServiceRadiusMiles(profile?.service_radius_miles ?? 10) ?? 10
  );

  const loadPreferences = useCallback(async () => {
    if (!profile?.id) return;
    setPreferencesLoading(true);
    setPreferencesError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setPreferencesLoading(false);
      return;
    }

    const fetchPreferences = async () =>
      supabase
        .from("provider_preferences")
        .select("*")
        .eq("provider_id", user.id)
        .single();

    let { data, error } = await fetchPreferences();
    if (error && (error.code === "PGRST116" || error.message.toLowerCase().includes("0 rows"))) {
      const { error: insertError } = await supabase.from("provider_preferences").insert({
        provider_id: user.id,
        accepts_recurring: true,
        accepts_premium: true,
        max_jobs_per_day: 3,
        preferred_arrival_windows: [],
        preferred_service_types: [],
      });
      if (!insertError) {
        const refetch = await fetchPreferences();
        data = refetch.data;
        error = refetch.error;
      } else {
        error = insertError;
      }
    }

    if (error) {
      setPreferences(null);
      setPreferencesError(error.message);
    } else {
      const normalized = (data as ProviderPreferences) ?? null;
      setPreferences(normalized);
      setDraftPreferences(normalized);
    }
    setPreferencesLoading(false);
  }, [profile?.id]);

  const loadScheduleSummary = useCallback(async () => {
    if (!profile?.id) return;
    setScheduleSummaryLoading(true);
    setScheduleSummaryError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      setScheduleSummaryLoading(false);
      return;
    }

    const { count, error } = await supabase
      .from("provider_availability_blocks")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", user.id)
      .eq("active", true);

    if (error) {
      setScheduleSummaryError(error.message);
      setHasWeeklyAvailability(false);
    } else {
      setHasWeeklyAvailability((count ?? 0) > 0);
    }
    setScheduleSummaryLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    void loadPreferences();
    void loadScheduleSummary();
  }, [loadPreferences, loadScheduleSummary]);

  if (!profile) return null;

  async function handleSave() {
    if (!profile) return;
    const clampedRadius = clampServiceRadiusMiles(radius) ?? SERVICE_RADIUS_MILES_MIN;
    if (!isValidServiceRadiusMiles(radius)) {
      setToast(`Service radius must be between ${SERVICE_RADIUS_MILES_MIN} and ${SERVICE_RADIUS_MILES_MAX} miles. Value was clamped.`);
    }
    setSaving(true);
    const profilePayload = {
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
      zip_code: zip.trim() || null,
      service_radius_miles: clampedRadius,
    };
    const traceUpd = await traceProfileWriteStart({
      source: "ProfileScreen.handleSave",
      operation: "update",
      targetId: profile.id,
      payload: profilePayload,
      pathname: "/csp/dashboard/profile",
      cspFlowState: {
        is_onboarded: profile.is_onboarded,
        application_status: profile.application_status,
      },
    });
    const updateResult = await supabase.from("profiles").update(profilePayload).eq("id", profile.id);
    traceProfileWriteResult(traceUpd, updateResult);
    const { error } = updateResult;
    if (error) {
      setSaving(false);
      setToast(error.message);
      return;
    }
    await refresh();
    setSaving(false);
    setEditing(false);
  }

  async function handleSavePreferences() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id || !draftPreferences) return;

    const safeMaxJobs = Number.isFinite(draftPreferences.max_jobs_per_day)
      ? Math.max(1, Math.round(draftPreferences.max_jobs_per_day))
      : 1;

    setPreferencesSaving(true);
    setPreferencesError(null);

    const { error } = await supabase.from("provider_preferences").upsert({
      provider_id: user.id,
      accepts_recurring: draftPreferences.accepts_recurring,
      accepts_premium: draftPreferences.accepts_premium,
      max_jobs_per_day: safeMaxJobs,
      updated_at: new Date().toISOString(),
    });

    setPreferencesSaving(false);
    if (error) {
      setPreferencesError(error.message);
      return;
    }

    await loadPreferences();
    setWorkSettingsOpen(false);
    setToast("Work settings updated");
    window.setTimeout(() => setToast(null), 2200);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div
      className="min-h-screen px-4 pt-6 pb-24"
      style={{ backgroundColor: CSP_BACKGROUND, color: CSP_TEXT_PRIMARY }}
    >
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Provider Profile</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Increase your booking volume by completing verification.
        </p>
      </header>

      {toast ? (
        <div
          className="mb-4 rounded-xl border px-3 py-2 text-sm"
          style={{
            backgroundColor: "rgba(141, 204, 100, 0.12)",
            borderColor: "rgba(141, 204, 100, 0.4)",
            color: CSP_TEXT_PRIMARY,
          }}
        >
          {toast}
        </div>
      ) : null}

      {/* Provider Profile */}
      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2
          className="text-sm font-medium mb-3"
          style={{ color: CSP_TEXT_SECONDARY }}
        >
          Provider Profile
        </h2>
        <div
          className="rounded-2xl border"
          style={{
            backgroundColor: CSP_SURFACE,
            padding: CSP_CARD_PADDING,
            borderColor: "rgba(248, 250, 252, 0.08)",
          }}
        >
          {editing ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: CSP_TEXT_SECONDARY }}>
                  Full name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-xl border-0 text-white placeholder:opacity-60 focus:ring-2 focus:ring-offset-0 focus:ring-white/30"
                  style={{ backgroundColor: CSP_INPUT, padding: "12px 14px" }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: CSP_TEXT_SECONDARY }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone"
                  className="w-full rounded-xl border-0 text-white placeholder:opacity-60 focus:ring-2 focus:ring-offset-0 focus:ring-white/30"
                  style={{ backgroundColor: CSP_INPUT, padding: "12px 14px" }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p>{profile.full_name || "No name set"}</p>
              <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                {profile.phone || "No phone set"}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Invite friends */}
      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <button
          type="button"
          className="w-full rounded-2xl border flex items-center gap-3 px-4 py-3 text-left transition-opacity hover:opacity-90"
          style={{
            backgroundColor: CSP_SURFACE,
            borderColor: "rgba(248, 250, 252, 0.08)",
            color: CSP_TEXT_PRIMARY,
          }}
          onClick={async () => {
            try {
              const { code } = await createReferral();
              const url = `${typeof window !== "undefined" ? window.location.origin : ""}/signin?ref=${encodeURIComponent(code)}`;
              await navigator.clipboard.writeText(url);
              setToast("Invite link copied");
              window.setTimeout(() => setToast(null), 2200);
            } catch {
              setToast("Could not copy link");
              window.setTimeout(() => setToast(null), 2200);
            }
          }}
        >
          <Share2 className="w-5 h-5 shrink-0" style={{ color: "rgba(141, 204, 100, 0.9)" }} />
          <div>
            <p className="text-sm font-medium">Invite friends</p>
            <p className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
              Get your invite link
            </p>
          </div>
        </button>
      </section>

      {/* Service Area */}
      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2
          className="text-sm font-medium mb-3"
          style={{ color: CSP_TEXT_SECONDARY }}
        >
          Service Area
        </h2>
        <div
          className="rounded-2xl border"
          style={{
            backgroundColor: CSP_SURFACE,
            padding: CSP_CARD_PADDING,
            borderColor: "rgba(248, 250, 252, 0.08)",
          }}
        >
          {editing ? (
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: CSP_TEXT_SECONDARY }}>
                  ZIP code
                </label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="ZIP code"
                  className="w-full rounded-xl border-0 text-white placeholder:opacity-60 focus:ring-2 focus:ring-offset-0 focus:ring-white/30"
                  style={{ backgroundColor: CSP_INPUT, padding: "12px 14px" }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: CSP_TEXT_SECONDARY }}>
                  Radius (miles)
                </label>
                <input
                  type="number"
                  min={SERVICE_RADIUS_MILES_MIN}
                  max={SERVICE_RADIUS_MILES_MAX}
                  value={radius}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (!Number.isFinite(next)) return;
                    setRadius(clampServiceRadiusMiles(next) ?? SERVICE_RADIUS_MILES_MIN);
                  }}
                  className="w-full rounded-xl border-0 text-white focus:ring-2 focus:ring-offset-0 focus:ring-white/30"
                  style={{ backgroundColor: CSP_INPUT, padding: "12px 14px" }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <p>ZIP: {profile.zip_code ?? "—"}</p>
              <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                Radius: {profile.service_radius_miles ?? "—"} miles
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Work Settings */}
      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: CSP_TEXT_SECONDARY }}>
          Work Settings
        </h2>
        <div
          className="rounded-2xl border"
          style={{
            backgroundColor: CSP_SURFACE,
            padding: CSP_CARD_PADDING,
            borderColor: "rgba(248, 250, 252, 0.08)",
          }}
        >
          <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
            Control the types of jobs you receive.
          </p>
          <div className="mt-3 space-y-1">
            {preferencesLoading ? (
              <div className="space-y-2 animate-pulse">
                <div
                  className="h-3 rounded"
                  style={{ width: "70%", backgroundColor: "rgba(248, 250, 252, 0.12)" }}
                />
                <div
                  className="h-3 rounded"
                  style={{ width: "74%", backgroundColor: "rgba(248, 250, 252, 0.12)" }}
                />
                <div
                  className="h-3 rounded"
                  style={{ width: "52%", backgroundColor: "rgba(248, 250, 252, 0.12)" }}
                />
              </div>
            ) : preferencesError ? (
              <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                Work settings unavailable: {preferencesError}
              </p>
            ) : (
              <>
                <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                  {preferences?.accepts_recurring
                    ? "Accepts recurring clients"
                    : "Recurring clients paused"}
                </p>
                <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                  {preferences?.accepts_premium
                    ? "Eligible for premium bookings"
                    : "Premium bookings paused"}
                </p>
                <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
                  Max {preferences?.max_jobs_per_day ?? 3} jobs per day
                </p>
              </>
            )}
          </div>

          <button
            type="button"
            className="w-full mt-4 py-3 rounded-xl font-medium text-sm transition-opacity hover:opacity-90 active:opacity-85"
            style={{
              backgroundColor: CSP_INPUT,
              color: CSP_TEXT_PRIMARY,
              border: "1px solid rgba(248, 250, 252, 0.08)",
            }}
            onClick={() => {
              setDraftPreferences(
                preferences ?? {
                  provider_id: profile.id,
                  accepts_recurring: true,
                  accepts_premium: true,
                  max_jobs_per_day: 3,
                  preferred_arrival_windows: [],
                  preferred_service_types: [],
                  updated_at: new Date().toISOString(),
                }
              );
              setSheetSnap("medium");
              setWorkSettingsOpen(true);
            }}
          >
            Edit Work Settings
          </button>
        </div>
      </section>

      {/* Schedule */}
      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: CSP_TEXT_SECONDARY }}>
          Schedule
        </h2>
        <div
          className="rounded-2xl border"
          style={{
            backgroundColor: CSP_SURFACE,
            padding: CSP_CARD_PADDING,
            borderColor: "rgba(248, 250, 252, 0.08)",
          }}
        >
          <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
            {scheduleSummaryLoading
              ? "Loading schedule..."
              : scheduleSummaryError
                ? "Schedule unavailable"
                : hasWeeklyAvailability
                  ? "Weekly availability set"
                  : "Not set"}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => navigate("/csp/dashboard/calendar?tab=availability")}
              className="w-full py-3 rounded-xl font-medium text-sm transition-opacity hover:opacity-90 active:opacity-85"
              style={{
                backgroundColor: CSP_INPUT,
                color: CSP_TEXT_PRIMARY,
                border: "1px solid rgba(248, 250, 252, 0.08)",
              }}
            >
              Edit weekly availability
            </button>
            <button
              type="button"
              onClick={() => navigate("/csp/dashboard/calendar")}
              className="w-full py-3 rounded-xl font-medium text-sm transition-opacity hover:opacity-90 active:opacity-85"
              style={{
                backgroundColor: CSP_INPUT,
                color: CSP_TEXT_PRIMARY,
                border: "1px solid rgba(248, 250, 252, 0.08)",
              }}
            >
              View calendar
            </button>
          </div>
        </div>
      </section>

      {/* Verification Status */}
      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: CSP_TEXT_SECONDARY }}>
          Verification Status
        </h2>
        <div
          className="rounded-2xl border space-y-1"
          style={{
            backgroundColor: CSP_SURFACE,
            padding: CSP_CARD_PADDING,
            borderColor: "rgba(248, 250, 252, 0.08)",
          }}
        >
          <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
            Customers trust verified pros.
          </p>
          <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
            Insurance + ID verification unlock higher-value jobs.
          </p>
          <p className="text-sm">
            Application: <span style={{ color: CSP_TEXT_SECONDARY }}>{profile.application_status ?? "draft"}</span>
          </p>
          <p className="text-sm">
            Insurance (optional): <span style={{ color: CSP_TEXT_SECONDARY }}>{profile.insurance_status ?? "not_started"}</span>
          </p>
          <p className="text-sm">
            Identity: <span style={{ color: CSP_TEXT_SECONDARY }}>{profile.identity_status ?? "not_started"}</span>
          </p>
        </div>
      </section>

      {/* Payout Setup */}
      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="text-sm font-medium mb-3" style={{ color: CSP_TEXT_SECONDARY }}>
          Payout Setup (Stripe)
        </h2>
        <div
          className="rounded-2xl border"
          style={{
            backgroundColor: CSP_SURFACE,
            padding: CSP_CARD_PADDING,
            borderColor: "rgba(248, 250, 252, 0.08)",
          }}
        >
          <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
            Connect Stripe to receive weekly payouts once your verification is approved.
          </p>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-col gap-3" style={{ marginTop: CSP_SECTION_GAP }}>
        {editing ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 active:opacity-85 disabled:opacity-50"
            style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setZip(profile?.zip_code ?? "");
              setRadius(clampServiceRadiusMiles(profile?.service_radius_miles ?? 10) ?? 10);
              setEditing(true);
            }}
            className="w-full py-3 rounded-xl font-medium text-sm transition-opacity hover:opacity-90 active:opacity-85"
            style={{
              backgroundColor: CSP_SURFACE,
              color: CSP_TEXT_PRIMARY,
              border: "1px solid rgba(248, 250, 252, 0.08)",
            }}
          >
            Edit Profile
          </button>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          className="py-2 text-sm font-medium transition-opacity hover:opacity-80"
          style={{ color: CSP_TEXT_SECONDARY }}
        >
          Sign Out
        </button>
      </div>

      <BottomSheet
        open={workSettingsOpen}
        onClose={() => setWorkSettingsOpen(false)}
        snap={sheetSnap}
        setSnap={setSheetSnap}
        title="Edit Work Settings"
        subtitle="Control the types of jobs you receive."
        tone="dark"
      >
        <div className="px-6 pt-6 pb-[calc(24px+env(safe-area-inset-bottom))] space-y-6">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="pr-4">
              <p className="text-sm font-semibold text-white">Accept Recurring Clients</p>
              <p className="mt-1 text-xs text-white/60">
                Allow weekly and bi-weekly maintenance bookings.
              </p>
            </div>
            <Toggle
              checked={Boolean(draftPreferences?.accepts_recurring)}
              onChange={(val) =>
                setDraftPreferences((prev) => (prev ? { ...prev, accepts_recurring: val } : prev))
              }
              disabled={preferencesSaving}
              tone="dark"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <div className="pr-4">
              <p className="text-sm font-semibold text-white">Accept Premium Jobs</p>
              <p className="mt-1 text-xs text-white/60">
                Higher-value bookings for verified providers.
              </p>
            </div>
            <Toggle
              checked={Boolean(draftPreferences?.accepts_premium)}
              onChange={(val) =>
                setDraftPreferences((prev) => (prev ? { ...prev, accepts_premium: val } : prev))
              }
              disabled={preferencesSaving}
              tone="dark"
            />
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-white">Max Jobs Per Day</p>
              <p className="mt-1 text-xs text-white/60">
                Limit the number of bookings you receive per day.
              </p>
            </div>
            <input
              type="number"
              min={1}
              value={draftPreferences?.max_jobs_per_day ?? 3}
              onChange={(e) =>
                setDraftPreferences((prev) =>
                  prev ? { ...prev, max_jobs_per_day: Number(e.target.value) } : prev
                )
              }
              className="w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSavePreferences()}
            disabled={preferencesSaving}
            className="mt-2 w-full rounded-xl py-3 font-semibold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          >
            {preferencesSaving ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
