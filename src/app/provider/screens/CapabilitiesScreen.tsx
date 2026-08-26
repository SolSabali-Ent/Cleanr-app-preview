import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Plus, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PersonCapability } from "@/domain/growth";
import { isOfflinePreviewMode } from "@/lib/supabase";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
import { listMyCapabilities, setMySelfCapability } from "@/lib/growthApi";
import {
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SURFACE,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

function sourceLabel(source: PersonCapability["source"]): string {
  switch (source) {
    case "verified": return "Verified by Cleanr";
    case "cleanr": return "Recognized by Cleanr";
    case "network": return "Recognized by the network";
    default: return "Self-declared";
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
      setError(err instanceof Error ? err.message : "Unable to load capabilities");
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
      setError(err instanceof Error ? err.message : "Unable to save capability");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.home)} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <ArrowLeft size={16} /> Growth
      </button>

      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <Sparkles size={14} style={{ color: CSP_PRIMARY_BUTTON }} />
          <span style={{ color: CSP_TEXT_SECONDARY }}>What you can create</span>
        </div>
        <h1 className="text-2xl font-semibold">Capabilities</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          Cleaning is one capability, not your permanent identity. Track skills and strengths that can create value for households, other CSPs, businesses, and the network.
        </p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
          <p className="text-sm font-medium">Add something you can do</p>
          <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
            Self-declared capabilities are yours to add. Cleanr-verified capabilities remain separate so provenance stays clear.
          </p>
          <div className="mt-4 flex gap-2">
            <input value={label} onChange={(event) => setLabel(event.target.value)} disabled={isOfflinePreviewMode} placeholder={isOfflinePreviewMode ? "Available when backend returns" : "e.g. mentoring new CSPs"} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm outline-none disabled:opacity-60" />
            <button type="button" disabled={isOfflinePreviewMode || label.trim().length < 2 || saving} onClick={() => void addCapability()} className="flex items-center justify-center rounded-xl px-4 text-white disabled:opacity-50" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}><Plus size={18} /></button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Your capabilities</h2>
        {capabilities.length === 0 ? (
          <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
            <p className="text-sm font-medium">No capabilities recorded yet.</p>
            <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
              As Cleanr learns what you do well, this can include service expertise, mentoring, leadership, business skills, and other strengths.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {capabilities.map((capability) => (
              <div key={capability.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                <div className="flex items-start gap-3">
                  <BadgeCheck size={19} style={{ color: capability.status === "verified" ? CSP_PRIMARY_BUTTON : CSP_TEXT_SECONDARY, marginTop: 2 }} />
                  <div>
                    <p className="text-sm font-medium">{capability.label}</p>
                    <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{sourceLabel(capability.source)} · {capability.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
