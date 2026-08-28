import { useEffect, useMemo, useState } from "react";
import { Sprout } from "lucide-react";
import type { ContinuumParticipation, ContinuumParticipationKey } from "@/domain/continuum";
import {
  SELF_DECLARABLE_CONTINUUM_PARTICIPATIONS,
  continuumParticipationLabel,
} from "@/domain/continuum";
import { listMyContinuumParticipations, setMyContinuumParticipation } from "@/lib/continuumApi";
import { isOfflinePreviewMode } from "@/lib/supabase";
import {
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SECTION_GAP,
  CSP_SURFACE,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

export function ContinuumParticipationCard() {
  const [participations, setParticipations] = useState<ContinuumParticipation[]>([]);
  const [busyKey, setBusyKey] = useState<ContinuumParticipationKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setParticipations(await listMyContinuumParticipations());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load how you participate in Cleanr.");
    }
  }

  useEffect(() => { void refresh(); }, []);

  const participationByKey = useMemo(
    () => new Map(participations.map((item) => [item.key, item])),
    [participations]
  );
  const evidenced = participations.filter((item) => item.evidenceStatus === "evidenced");
  const selfDescriptionOptions = SELF_DECLARABLE_CONTINUUM_PARTICIPATIONS.filter(
    (option) => participationByKey.get(option.key)?.evidenceStatus !== "evidenced"
  );

  async function toggle(key: ContinuumParticipationKey) {
    if (isOfflinePreviewMode || busyKey) return;
    const current = participationByKey.get(key);
    if (current?.evidenceStatus === "evidenced") return;

    try {
      setBusyKey(key);
      setError(null);
      await setMyContinuumParticipation(key, current?.evidenceStatus !== "self_declared");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update participation.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section style={{ color: CSP_TEXT_PRIMARY, marginBottom: CSP_SECTION_GAP }}>
      <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>
        Your Continuum
      </h2>
      <div
        className="rounded-2xl border"
        style={{
          backgroundColor: CSP_SURFACE,
          borderColor: "rgba(248,250,252,.08)",
          padding: CSP_CARD_PADDING,
        }}
      >
        <div className="flex items-start gap-3">
          <Sprout size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
          <div>
            <p className="text-sm font-medium">How you participate can evolve</p>
            <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
              Cleaning does not have to become your permanent identity, and moving beyond cleaning is not a higher rank. These are simply other ways you may participate in Cleanr over time.
            </p>
          </div>
        </div>

        {evidenced.length > 0 ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-xs font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Backed by activity in Cleanr</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {evidenced.map((item) => (
                <span key={item.id} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "rgba(141,204,100,.3)", backgroundColor: "rgba(141,204,100,.08)" }}>
                  {continuumParticipationLabel(item.key)} · evidenced
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
              These reflect durable Cleanr activity, so they are not editable as self-descriptions while that evidence remains true.
            </p>
          </div>
        ) : null}

        {selfDescriptionOptions.length > 0 ? (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-sm font-medium">Also true about me</p>
            <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
              These are self-descriptions, not Cleanr verification. Choose only what is true now; you can change it later.
            </p>
            <div className="mt-3 space-y-2">
              {selfDescriptionOptions.map((option) => {
                const active = participationByKey.get(option.key)?.evidenceStatus === "self_declared";
                return (
                  <button
                    key={option.key}
                    type="button"
                    disabled={isOfflinePreviewMode || busyKey === option.key}
                    onClick={() => void toggle(option.key)}
                    className="w-full rounded-xl border px-3 py-3 text-left disabled:opacity-60"
                    style={{
                      borderColor: active ? CSP_PRIMARY_BUTTON : "rgba(248,250,252,.10)",
                      backgroundColor: active ? `${CSP_PRIMARY_BUTTON}18` : "rgba(255,255,255,.03)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{option.label}</p>
                        <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{option.description}</p>
                      </div>
                      <span className="text-xs" style={{ color: active ? CSP_PRIMARY_BUTTON : CSP_TEXT_SECONDARY }}>{active ? "On" : "Off"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
        <p className="mt-4 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
          Participation never changes your Jobs access, payouts, ranking, or standing. A strong residential cleaning practice can remain your destination for as long as you want.
        </p>
      </div>
    </section>
  );
}
