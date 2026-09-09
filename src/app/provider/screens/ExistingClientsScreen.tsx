import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Copy, RefreshCw, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createExistingClientInvite } from "@/lib/referralApi";
import { supabase } from "@/lib/supabase";
import {
  CSP_BACKGROUND,
  CSP_PRIMARY_BUTTON,
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
          title: "Connect with me on Cleanr",
          text: "Use this link so Cleanr knows we already work together.",
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
    <div className="min-h-screen px-4 pb-24 pt-6" style={{ backgroundColor: CSP_BACKGROUND, color: CSP_TEXT_PRIMARY }}>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 flex items-center gap-2 text-sm"
        style={{ color: CSP_TEXT_SECONDARY }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <header className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: CSP_TEXT_SECONDARY }}>
          Existing relationship
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Bring an existing client into Cleanr</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          Use this for a household you already serve. Cleanr preserves that the relationship started with you.
        </p>
      </header>

      <section className="mb-6 border-y border-white/10 py-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Your Cleanr fee</p>
            <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
              This relationship originated with you.
            </p>
          </div>
          <p className="text-2xl font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>
            {feeLoading ? "—" : feePercent == null ? "—" : `${feePercent}%`}
          </p>
        </div>
        {!feeLoading && feePercent == null ? (
          <p className="mt-3 text-xs text-red-300">We couldn't load your fee. Try again before creating an invite.</p>
        ) : null}
      </section>

      <section className="mb-7">
        <button
          type="button"
          disabled={busy || feeLoading || feePercent == null}
          onClick={() => void createInvite()}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
        >
          {busy ? "Creating invite…" : feeLoading ? "Loading…" : "Create relationship invite"}
        </button>
        <p className="mt-2 text-center text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
          Create one invite for each household, then send it directly to that client.
        </p>
      </section>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: CSP_TEXT_SECONDARY }}>Relationships</p>
            <h2 className="mt-1 text-lg font-semibold">Existing-client invites</h2>
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
            className="flex items-center gap-1.5 py-2 text-xs font-medium disabled:opacity-50"
            style={{ color: CSP_TEXT_SECONDARY }}
          >
            <RefreshCw size={14} className={historyLoading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>

        {historyLoading ? (
          <div className="border-y border-white/10 py-5">
            <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading relationships…</p>
          </div>
        ) : historyError ? (
          <p className="text-sm text-red-300">{historyError}</p>
        ) : invites.length === 0 ? (
          <div className="border-y border-white/10 py-5">
            <p className="text-sm font-medium">No invites yet</p>
            <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Create the first relationship invite above.</p>
          </div>
        ) : (
          <div className="border-y border-white/10">
            {invites.map((invite, index) => {
              const connected = Boolean(invite.relationship_confirmed_at);
              const hasLink = Boolean(invitationUrl(invite.code));
              return (
                <div key={invite.id} className={`py-4 ${index < invites.length - 1 ? "border-b border-white/10" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {connected ? (
                          <CheckCircle2 size={18} style={{ color: CSP_PRIMARY_BUTTON }} />
                        ) : (
                          <Clock3 size={18} style={{ color: CSP_TEXT_SECONDARY }} />
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{connected ? "Relationship connected" : "Waiting for client"}</p>
                          {newInviteId === invite.id ? (
                            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold" style={{ color: CSP_PRIMARY_BUTTON }}>New</span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>Created {formatDate(invite.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {!connected && hasLink ? (
                    <div className="mt-3 flex gap-2 pl-8">
                      <button
                        type="button"
                        onClick={() => void copyInvite(invite)}
                        className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold"
                      >
                        <Copy size={14} /> {copiedId === invite.id ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void shareInvite(invite)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white"
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
