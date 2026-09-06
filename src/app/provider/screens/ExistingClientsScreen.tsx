import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Copy, RefreshCw, Share2 } from "lucide-react";
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

type ExistingClientInviteRow = {
  id: string;
  code: string | null;
  status: string;
  created_at: string;
  referee_id: string | null;
  relationship_confirmed_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function invitationUrl(code: string | null) {
  if (!code || typeof window === "undefined") return null;
  return `${window.location.origin}/signin?ref=${encodeURIComponent(code)}`;
}

export default function ExistingClientsScreen() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feeRate, setFeeRate] = useState<number | null>(null);
  const [feeLoading, setFeeLoading] = useState(true);
  const [invites, setInvites] = useState<ExistingClientInviteRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [newInviteId, setNewInviteId] = useState<string | null>(null);

  const loadInvites = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    const { data, error: inviteError } = await supabase
      .from("referrals")
      .select("id,code,status,created_at,referee_id,relationship_confirmed_at")
      .eq("referral_kind", "existing_client")
      .order("created_at", { ascending: false })
      .limit(25);

    if (inviteError) {
      setHistoryError(inviteError.message);
      setInvites([]);
    } else {
      setInvites((data ?? []) as ExistingClientInviteRow[]);
    }
    setHistoryLoading(false);
  }, []);

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
    void loadInvites();
    return () => {
      active = false;
    };
  }, [loadInvites]);

  async function createInvite() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setCopiedId(null);
    try {
      const result = await createExistingClientInvite();
      setNewInviteId(result.id);
      await loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create this invite.");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite(invite: ExistingClientInviteRow) {
    const url = invitationUrl(invite.code);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invite.id);
      window.setTimeout(() => setCopiedId((current) => (current === invite.id ? null : current)), 2200);
    } catch {
      setError("We couldn't copy the link. Try sharing it instead.");
    }
  }

  async function shareInvite(invite: ExistingClientInviteRow) {
    const url = invitationUrl(invite.code);
    if (!url) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join me on Cleanr",
          text: "Use this link to connect with me on Cleanr.",
          url,
        });
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      }
    }

    await copyInvite(invite);
  }

  const feePercent = feeRate == null ? null : Math.round(feeRate * 1000) / 10;
  const counts = useMemo(() => {
    const connected = invites.filter((invite) => Boolean(invite.relationship_confirmed_at)).length;
    return { connected, waiting: invites.length - connected };
  }, [invites]);

  return (
    <div className="min-h-screen px-4 pt-6 pb-24" style={{ backgroundColor: CSP_BACKGROUND, color: CSP_TEXT_PRIMARY }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 flex items-center gap-2 text-sm"
        style={{ color: CSP_TEXT_SECONDARY }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Bring a client to Cleanr</h1>
        <p className="mt-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
          For someone you already clean for.
        </p>
      </header>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div
          className="rounded-2xl border"
          style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Your Cleanr fee</p>
              <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                Because you brought the client.
              </p>
            </div>
            <p className="text-2xl font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>
              {feeLoading ? "—" : feePercent == null ? "—" : `${feePercent}%`}
            </p>
          </div>
          {!feeLoading && feePercent == null ? (
            <p className="mt-3 text-xs text-red-300">We couldn't load your fee. Try again before creating an invite.</p>
          ) : null}
        </div>
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="grid grid-cols-3 gap-2 text-center">
          {["Create link", "Send it", "They sign in"].map((step, index) => (
            <div key={step} className="rounded-xl border px-2 py-3" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
              <div className="mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold" style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}20`, color: CSP_PRIMARY_BUTTON }}>
                {index + 1}
              </div>
              <p className="mt-2 text-xs font-medium">{step}</p>
            </div>
          ))}
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
          {busy ? "Creating link…" : feeLoading ? "Loading…" : "Create invite link"}
        </button>
        <p className="mt-2 text-center text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>
          Create one link for each household.
        </p>
      </section>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Invites</h2>
            {!historyLoading ? (
              <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                {counts.connected} connected · {counts.waiting} waiting
              </p>
            ) : null}
          </div>
          <button
            type="button"
            disabled={historyLoading}
            onClick={() => void loadInvites()}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium disabled:opacity-50"
          >
            <RefreshCw size={14} className={historyLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {historyLoading ? (
          <div className="rounded-2xl border p-4" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading invites...</p>
          </div>
        ) : historyError ? (
          <p className="text-sm text-red-300">{historyError}</p>
        ) : invites.length === 0 ? (
          <div className="rounded-2xl border p-4" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
            <p className="text-sm font-medium">No invites yet</p>
            <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Create your first link above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invites.map((invite) => {
              const connected = Boolean(invite.relationship_confirmed_at);
              const hasLink = Boolean(invitationUrl(invite.code));
              return (
                <div
                  key={invite.id}
                  className="rounded-2xl border p-4"
                  style={{
                    backgroundColor: connected ? "rgba(141,204,100,.06)" : CSP_SURFACE,
                    borderColor: connected ? "rgba(141,204,100,.24)" : "rgba(248,250,252,.08)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      {connected ? (
                        <CheckCircle2 size={18} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 1 }} />
                      ) : (
                        <Clock3 size={18} style={{ color: CSP_TEXT_SECONDARY, marginTop: 1 }} />
                      )}
                      <div>
                        <p className="text-sm font-medium">{connected ? "Connected" : "Waiting for client"}</p>
                        <p className="mt-1 text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>Created {formatDate(invite.created_at)}</p>
                      </div>
                    </div>
                    {newInviteId === invite.id ? (
                      <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ backgroundColor: "rgba(141,204,100,.12)", color: CSP_PRIMARY_BUTTON }}>
                        New
                      </span>
                    ) : null}
                  </div>

                  {!connected && hasLink ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void copyInvite(invite)}
                        className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold"
                      >
                        <Copy size={14} /> {copiedId === invite.id ? "Copied" : "Copy link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void shareInvite(invite)}
                        className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-white"
                        style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
                      >
                        <Share2 size={14} /> Share
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
