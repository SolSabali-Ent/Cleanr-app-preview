import { useState } from "react";
import { ArrowLeft, Copy, Link2, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createExistingClientInvite } from "@/lib/referralApi";
import {
  CSP_BACKGROUND,
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SECTION_GAP,
  CSP_SURFACE,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

export default function ExistingClientsScreen() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function createInvite() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const { code } = await createExistingClientInvite();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      setInviteUrl(`${origin}/signin?ref=${encodeURIComponent(code)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create this invitation.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Your browser could not copy the link. You can select and copy it manually.");
    }
  }

  return (
    <div className="min-h-screen px-4 pt-6 pb-24" style={{ backgroundColor: CSP_BACKGROUND, color: CSP_TEXT_PRIMARY }}>
      <button
        type="button"
        onClick={() => navigate("/csp/dashboard/profile")}
        className="mb-5 flex items-center gap-2 text-sm"
        style={{ color: CSP_TEXT_SECONDARY }}
      >
        <ArrowLeft size={16} /> Profile
      </button>

      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <UsersRound size={14} style={{ color: CSP_PRIMARY_BUTTON }} />
          <span style={{ color: CSP_TEXT_SECONDARY }}>Founding Circle</span>
        </div>
        <h1 className="text-2xl font-semibold">Bring an existing client</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          Use this only for a household you already worked with before Cleanr. Cleanr will preserve that relationship as yours-in-practice rather than pretending the platform created it.
        </p>
      </header>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div
          className="rounded-2xl border"
          style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}
        >
          <div className="flex items-start gap-3">
            <Link2 size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
            <div>
              <p className="text-sm font-medium">What this link means</p>
              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                The customer must create or sign into their own Cleanr account. Only after they authenticate does Cleanr record the existing relationship. We do not invent past Cleanr bookings, completed-service counts, or customer consent.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <button
          type="button"
          disabled={busy}
          onClick={() => void createInvite()}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
        >
          {busy ? "Creating link…" : "Create existing-client link"}
        </button>
      </section>

      {inviteUrl ? (
        <section style={{ marginBottom: CSP_SECTION_GAP }}>
          <div
            className="rounded-2xl border"
            style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}
          >
            <p className="text-sm font-medium">Single-use client invitation</p>
            <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
              Send this link to the specific household whose relationship you are bringing into Cleanr.
            </p>
            <div className="mt-3 break-all rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
              {inviteUrl}
            </div>
            <button
              type="button"
              onClick={() => void copyInvite()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold"
            >
              <Copy size={16} /> {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      <p className="text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
        Existing-client provenance is relationship truth, not permanent lock-in. The customer can still choose another CSP, and Cleanr must keep earning its role through useful infrastructure and collective value.
      </p>
    </div>
  );
}
