import { useEffect, useState } from "react";
import { ArrowLeft, Copy, Link2, ReceiptText, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createExistingClientInvite } from "@/lib/referralApi";
import { supabase } from "@/lib/supabase";
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
  const [feeRate, setFeeRate] = useState<number | null>(null);
  const [feeLoading, setFeeLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadFeePolicy() {
      setFeeLoading(true);
      const { data, error: feeError } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "provider_brought_platform_fee_rate")
        .maybeSingle();

      if (!active) return;

      if (!feeError) {
        const parsed = Number((data as { value?: string } | null)?.value);
        if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) setFeeRate(parsed);
      }
      setFeeLoading(false);
    }

    void loadFeePolicy();
    return () => {
      active = false;
    };
  }, []);

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

  const feePercent = feeRate == null ? null : Math.round(feeRate * 1000) / 10;

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
          style={{ backgroundColor: "rgba(141,204,100,.08)", borderColor: "rgba(141,204,100,.22)", padding: CSP_CARD_PADDING }}
        >
          <div className="flex items-start gap-3">
            <ReceiptText size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
            <div>
              <p className="text-sm font-medium">Relationship-origin pricing</p>
              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                {feeLoading
                  ? "Loading the current provider-brought relationship fee…"
                  : feePercent == null
                    ? "The current provider-brought relationship fee could not be loaded. Do not create an invite until the policy is available."
                    : `For a paid booking that continues this provider-brought relationship, Cleanr currently keeps ${feePercent}% of the service price as its platform fee. The customer pays the normal service price; the fee is snapshotted on that booking at checkout.`}
              </p>
              <p className="mt-2 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
                This rate reflects that you created the relationship before Cleanr. It can evolve as the services Cleanr provides evolve, but the booking keeps the fee snapshot that applied at checkout.
              </p>
            </div>
          </div>
        </div>
      </section>

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
          disabled={busy || feeLoading || feePercent == null}
          onClick={() => void createInvite()}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
        >
          {busy ? "Creating link…" : feeLoading ? "Loading fee policy…" : "Create existing-client link"}
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
