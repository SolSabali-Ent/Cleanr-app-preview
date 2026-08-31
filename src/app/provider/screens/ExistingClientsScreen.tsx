import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Copy, Link2, ReceiptText, RefreshCw, UsersRound } from "lucide-react";
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
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
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
      setError(err instanceof Error ? err.message : "Unable to create this invitation.");
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
      setError("Your browser could not copy the link. You can select and copy it manually.");
    }
  }

  const feePercent = feeRate == null ? null : Math.round(feeRate * 1000) / 10;
  const counts = useMemo(() => {
    const confirmed = invites.filter((invite) => Boolean(invite.relationship_confirmed_at)).length;
    return { confirmed, pending: invites.length - confirmed };
  }, [invites]);

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

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div
          className="rounded-2xl border"
          style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Existing-client relationships</p>
              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                {counts.confirmed} confirmed · {counts.pending} awaiting customer
              </p>
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
            <p className="mt-4 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Loading relationship status…</p>
          ) : historyError ? (
            <p className="mt-4 text-xs text-red-300">{historyError}</p>
          ) : invites.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium">No invitations yet</p>
              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                Create one link per existing household. The relationship is only confirmed after that customer authenticates and accepts it.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {invites.map((invite) => {
                const confirmed = Boolean(invite.relationship_confirmed_at);
                const url = invitationUrl(invite.code);
                return (
                  <div
                    key={invite.id}
                    className="rounded-xl border p-4"
                    style={{
                      borderColor: confirmed ? "rgba(141,204,100,.24)" : "rgba(248,250,252,.08)",
                      backgroundColor: confirmed ? "rgba(141,204,100,.06)" : "rgba(255,255,255,.03)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        {confirmed ? (
                          <CheckCircle2 size={18} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 1 }} />
                        ) : (
                          <Clock3 size={18} style={{ color: CSP_TEXT_SECONDARY, marginTop: 1 }} />
                        )}
                        <div>
                          <p className="text-sm font-medium">{confirmed ? "Relationship confirmed" : "Awaiting customer"}</p>
                          <p className="mt-1 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
                            Created {formatDate(invite.created_at)}
                            {confirmed ? ` · confirmed ${formatDate(invite.relationship_confirmed_at)}` : " · single-use invitation"}
                          </p>
                        </div>
                      </div>
                      {newInviteId === invite.id ? (
                        <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ backgroundColor: "rgba(141,204,100,.12)", color: CSP_PRIMARY_BUTTON }}>
                          New
                        </span>
                      ) : null}
                    </div>

                    {!confirmed && url ? (
                      <>
                        <div className="mt-3 break-all rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>
                          {url}
                        </div>
                        <button
                          type="button"
                          onClick={() => void copyInvite(invite)}
                          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-semibold"
                        >
                          <Copy size={14} /> {copiedId === invite.id ? "Copied" : "Copy invitation link"}
                        </button>
                      </>
                    ) : null}

                    {confirmed ? (
                      <p className="mt-3 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                        Cleanr has durable consented provenance for this provider-brought relationship. Future relationship-aware bookings can carry that origin into checkout economics without pretending Cleanr created the relationship.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <p className="text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
        Existing-client provenance is relationship truth, not permanent lock-in. The customer can still choose another CSP, and Cleanr must keep earning its role through useful infrastructure and collective value.
      </p>
    </div>
  );
}
