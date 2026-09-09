import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PersonCapability } from "@/domain/growth";
import { isOfflinePreviewMode } from "@/lib/supabase";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
import { listMyCapabilities, setMySelfCapability } from "@/lib/growthApi";
import {
  CSP_PRIMARY_BUTTON,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

function sourceLabel(source: PersonCapability["source"]): string {
  switch (source) {
    case "verified": return "Verified by Cleanr";
    case "cleanr": return "Recognized by Cleanr";
    case "network": return "Recognized by the network";
    default: return "Added by you";
  }
}

export default function CapabilitiesScreen() {
  const navigate = useNavigate();
  const [capabilities, setCapabilities] = useState<PersonCapability[]>([]);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setCapabilities(await listMyCapabilities());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load skills");
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function addCapability() {
    if (isOfflinePreviewMode || label.trim().length < 2 || saving) return;
    try {
      setSaving(true);
      setError(null);
      await setMySelfCapability(label.trim(), "active");
      setLabel("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save skill");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.home)} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <ArrowLeft size={16} /> North Star
      </button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Skills & strengths</h1>
        <p className="mt-1 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
          Add what you&apos;re good at so Cleanr can recognize what you can contribute and what may fit you next.
        </p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <section className="mb-7">
        <div className="flex gap-2">
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={isOfflinePreviewMode}
            placeholder={isOfflinePreviewMode ? "Available when backend returns" : "e.g. mentoring new CSPs"}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none disabled:opacity-60"
          />
          <button
            type="button"
            aria-label="Add skill"
            disabled={isOfflinePreviewMode || label.trim().length < 2 || saving}
            onClick={() => void addCapability()}
            className="flex min-h-12 min-w-12 items-center justify-center rounded-xl text-white disabled:opacity-50"
            style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
          >
            <Plus size={18} />
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
          Cleanr keeps verified skills labeled separately.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Your skills</h2>
        {capabilities.length === 0 ? (
          <div className="border-y border-white/10 py-5">
            <p className="text-sm font-medium">Nothing added yet.</p>
            <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Start with one skill you want the network to know about.</p>
          </div>
        ) : (
          <div className="border-y border-white/10">
            {capabilities.map((capability, index) => (
              <div key={capability.id} className={`flex items-start gap-3 py-4 ${index > 0 ? "border-t border-white/10" : ""}`}>
                <BadgeCheck size={18} className="mt-0.5 shrink-0" style={{ color: capability.status === "verified" ? CSP_PRIMARY_BUTTON : CSP_TEXT_SECONDARY }} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{capability.label}</p>
                  <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{sourceLabel(capability.source)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
