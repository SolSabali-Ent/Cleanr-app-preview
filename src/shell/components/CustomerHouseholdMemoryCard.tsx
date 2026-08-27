import { useEffect, useState } from "react";
import { Home } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { getMyHouseholdContext, setMyHouseholdContext } from "@/lib/householdContextApi";
import { isOfflinePreviewMode } from "@/lib/supabase";

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function CustomerHouseholdMemoryCard() {
  const [loading, setLoading] = useState(!isOfflinePreviewMode);
  const [saving, setSaving] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [servicePreferences, setServicePreferences] = useState("");
  const [petContext, setPetContext] = useState("");
  const [surfacesToAvoid, setSurfacesToAvoid] = useState("");
  const [communicationPreferences, setCommunicationPreferences] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOfflinePreviewMode) {
      setLoading(false);
      return;
    }

    let active = true;
    void getMyHouseholdContext()
      .then((context) => {
        if (!active || !context) return;
        setMemoryEnabled(context.memoryEnabled);
        setServicePreferences(context.servicePreferences ?? "");
        setPetContext(context.petContext ?? "");
        setSurfacesToAvoid(context.surfacesToAvoid ?? "");
        setCommunicationPreferences(context.communicationPreferences ?? "");
        setUpdatedAt(context.updatedAt);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Household memory is temporarily unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  function markChanged() {
    setSaved(false);
  }

  async function saveMemory() {
    if (isOfflinePreviewMode || saving) return;
    try {
      setSaving(true);
      setSaved(false);
      setError(null);
      const context = await setMyHouseholdContext({
        memoryEnabled,
        servicePreferences: memoryEnabled ? emptyToNull(servicePreferences) : null,
        petContext: memoryEnabled ? emptyToNull(petContext) : null,
        surfacesToAvoid: memoryEnabled ? emptyToNull(surfacesToAvoid) : null,
        communicationPreferences: memoryEnabled ? emptyToNull(communicationPreferences) : null,
      });
      setMemoryEnabled(context.memoryEnabled);
      setServicePreferences(context.servicePreferences ?? "");
      setPetContext(context.petContext ?? "");
      setSurfacesToAvoid(context.surfacesToAvoid ?? "");
      setCommunicationPreferences(context.communicationPreferences ?? "");
      setUpdatedAt(context.updatedAt);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reusable household preferences could not be saved yet.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="provider-card p-4 mb-3">
      <div className="flex items-start gap-3">
        <Home className="mt-0.5 h-5 w-5 text-[#8DCC64]" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Household memory</p>
          <p className="mt-1 text-xs leading-5 text-[#667085]">
            You decide what Cleanr may remember across visits. This is for reusable service preferences only. Door codes, gate codes, keys, passwords, alarms, and one-visit entry instructions never belong here.
          </p>
        </div>
      </div>

      {loading ? <p className="mt-4 text-xs text-[#667085]">Loading household memory…</p> : (
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3 rounded-xl border border-[#E5E7EB] p-3">
            <input
              type="checkbox"
              checked={memoryEnabled}
              disabled={isOfflinePreviewMode}
              onChange={(event) => { setMemoryEnabled(event.target.checked); markChanged(); }}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="block text-sm font-medium">Remember reusable household preferences</span>
              <span className="mt-1 block text-xs leading-5 text-[#667085]">
                Turning this off clears reusable household memory. It does not alter booking-specific access details.
              </span>
            </span>
          </label>

          {memoryEnabled ? (
            <>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#667085]">How you like service handled</span>
                <textarea value={servicePreferences} maxLength={1000} rows={3} onChange={(event) => { setServicePreferences(event.target.value); markChanged(); }} className="w-full resize-none rounded-lg border border-[#E5E7EB] p-2 text-sm" placeholder="Reusable preferences that matter across visits" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#667085]">Pets</span>
                <textarea value={petContext} maxLength={1000} rows={2} onChange={(event) => { setPetContext(event.target.value); markChanged(); }} className="w-full resize-none rounded-lg border border-[#E5E7EB] p-2 text-sm" placeholder="Only details useful across visits" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#667085]">Surfaces or items to avoid</span>
                <textarea value={surfacesToAvoid} maxLength={1000} rows={2} onChange={(event) => { setSurfacesToAvoid(event.target.value); markChanged(); }} className="w-full resize-none rounded-lg border border-[#E5E7EB] p-2 text-sm" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[#667085]">Communication preferences</span>
                <textarea value={communicationPreferences} maxLength={1000} rows={2} onChange={(event) => { setCommunicationPreferences(event.target.value); markChanged(); }} className="w-full resize-none rounded-lg border border-[#E5E7EB] p-2 text-sm" placeholder="For example: text before arrival" />
              </label>
            </>
          ) : null}

          <Button variant="primaryBlue" size="md" fullWidth loading={saving} disabled={isOfflinePreviewMode} onClick={() => void saveMemory()}>
            {saved ? "Household memory saved" : memoryEnabled ? "Save household memory" : "Turn off household memory"}
          </Button>

          {isOfflinePreviewMode ? (
            <p className="text-xs leading-5 text-[#667085]">Preview mode shows the real consent model. Saving activates when the backend is connected.</p>
          ) : updatedAt ? (
            <p className="text-xs text-[#667085]">Last updated {new Date(updatedAt).toLocaleString()}.</p>
          ) : null}
          {error ? <p className="text-xs text-red-600" role="alert">{error}</p> : null}
        </div>
      )}
    </section>
  );
}
