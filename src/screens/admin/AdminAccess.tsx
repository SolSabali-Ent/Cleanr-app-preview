import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useIsAdmin } from "../../lib/useIsAdmin";
import {
  AdminDangerButton,
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminStatus,
  AdminTableShell,
} from "./AdminUi";

type CandidateRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  primary_role: string | null;
  has_admin_authority: boolean;
  membership_granted_at: string | null;
  membership_granted_by: string | null;
  membership_note: string | null;
};

type AdminEventRow = {
  id: string;
  user_id: string;
  action: "granted" | "revoked";
  actor_id: string | null;
  note: string | null;
  occurred_at: string;
};

function displayName(row: CandidateRow): string {
  return row.full_name?.trim() || row.email?.trim() || row.user_id;
}

export function AdminAccess() {
  const { isAdmin, loading: adminLoading, userId } = useIsAdmin();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [events, setEvents] = useState<AdminEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingUserId, setWorkingUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMessage(null);

    const [candidateResult, eventResult] = await Promise.all([
      supabase.rpc("admin_list_platform_admin_candidates"),
      supabase
        .from("platform_admin_membership_events")
        .select("id,user_id,action,actor_id,note,occurred_at")
        .order("occurred_at", { ascending: false })
        .limit(50),
    ]);

    if (candidateResult.error) {
      setMessage(candidateResult.error.message);
      setCandidates([]);
      setEvents([]);
      setLoading(false);
      return;
    }

    setCandidates((candidateResult.data ?? []) as CandidateRow[]);
    if (eventResult.error) {
      setMessage(eventResult.error.message);
      setEvents([]);
    } else {
      setEvents((eventResult.data ?? []) as AdminEventRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin]);

  const candidateMap = useMemo(() => new Map(candidates.map((candidate) => [candidate.user_id, candidate])), [candidates]);
  const adminCount = candidates.filter((candidate) => candidate.has_admin_authority).length;

  async function grant(candidate: CandidateRow) {
    const note = window.prompt(`Why should ${displayName(candidate)} receive platform admin access?`, "Independent provider reviewer");
    if (note === null) return;

    setWorkingUserId(candidate.user_id);
    setMessage(null);
    const { error } = await supabase.rpc("admin_grant_platform_admin", { p_user_id: candidate.user_id, p_note: note });
    setWorkingUserId(null);
    if (error) return setMessage(error.message);
    setMessage(`Platform admin access granted to ${displayName(candidate)}.`);
    await load();
  }

  async function revoke(candidate: CandidateRow) {
    const note = window.prompt(`Why are you revoking platform admin access from ${displayName(candidate)}?`, "Access no longer required");
    if (note === null) return;

    setWorkingUserId(candidate.user_id);
    setMessage(null);
    const { error } = await supabase.rpc("admin_revoke_platform_admin", { p_user_id: candidate.user_id, p_note: note });
    setWorkingUserId(null);
    if (error) return setMessage(error.message);
    setMessage(`Platform admin access revoked from ${displayName(candidate)}.`);
    await load();
  }

  if (adminLoading) return <p className="text-sm text-slate-500">Loading admin session…</p>;
  if (!isAdmin) return <p className="text-sm text-slate-500">Admin access required.</p>;

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Governance"
        title="Admin access"
        description="Manage platform authority separately from each person’s customer or CSP role."
        meta={<span className="text-xs text-slate-500">{adminCount} platform admin{adminCount === 1 ? "" : "s"} · {candidates.length} Cleanr account{candidates.length === 1 ? "" : "s"}</span>}
        actions={<AdminSecondaryButton onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</AdminSecondaryButton>}
      />

      {message ? <AdminNotice>{message}</AdminNotice> : null}

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-950">Access roster</h2>
          <p className="mt-1 text-xs text-slate-500">Database rules still prevent self-review and removal of the last remaining admin authority.</p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading accounts…</div>
        ) : candidates.length === 0 ? (
          <AdminEmptyState title="No Cleanr accounts found" />
        ) : (
          <AdminTableShell>
            <div className="grid grid-cols-[minmax(240px,1.3fr)_180px_220px_180px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span>Person</span><span>Primary role</span><span>Authority</span><span className="text-right">Action</span>
            </div>
            {candidates.map((candidate) => {
              const isCurrentUser = candidate.user_id === userId;
              const isWorking = workingUserId === candidate.user_id;
              return (
                <div key={candidate.user_id} className="grid grid-cols-[minmax(240px,1.3fr)_180px_220px_180px] items-center gap-4 border-b border-slate-200 px-5 py-4 last:border-b-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-950">{displayName(candidate)}</p>
                      {isCurrentUser ? <AdminStatus>You</AdminStatus> : null}
                    </div>
                    {candidate.email ? <p className="mt-1 truncate text-xs text-slate-500">{candidate.email}</p> : null}
                  </div>
                  <p className="text-sm capitalize text-slate-600">{candidate.primary_role ?? "—"}</p>
                  <div>
                    <AdminStatus tone={candidate.has_admin_authority ? "success" : "neutral"}>
                      {candidate.has_admin_authority ? "Platform admin" : "Standard access"}
                    </AdminStatus>
                    {candidate.membership_granted_at ? <p className="mt-1 text-[11px] text-slate-500">Granted {new Date(candidate.membership_granted_at).toLocaleDateString()}</p> : null}
                  </div>
                  <div className="text-right">
                    {candidate.has_admin_authority ? (
                      <AdminDangerButton disabled={isWorking || candidate.primary_role === "admin"} onClick={() => void revoke(candidate)}>
                        {isWorking ? "Working…" : "Revoke"}
                      </AdminDangerButton>
                    ) : (
                      <AdminPrimaryButton disabled={isWorking} onClick={() => void grant(candidate)}>
                        {isWorking ? "Working…" : "Grant access"}
                      </AdminPrimaryButton>
                    )}
                  </div>
                </div>
              );
            })}
          </AdminTableShell>
        )}
      </section>

      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">Access history · {events.length}</summary>
        <div className="border-t border-slate-200">
          {events.length === 0 ? (
            <p className="px-5 py-5 text-sm text-slate-500">No access events yet.</p>
          ) : events.map((event) => {
            const subject = candidateMap.get(event.user_id);
            const actor = event.actor_id ? candidateMap.get(event.actor_id) : null;
            const fallback: CandidateRow = { user_id: event.user_id, email: null, full_name: null, primary_role: null, has_admin_authority: false, membership_granted_at: null, membership_granted_by: null, membership_note: null };
            return (
              <div key={event.id} className="grid grid-cols-[minmax(220px,1fr)_140px_minmax(240px,1.2fr)] gap-4 border-b border-slate-200 px-5 py-3 text-xs last:border-b-0">
                <div>
                  <p className="font-semibold text-slate-900">{displayName(subject ?? fallback)}</p>
                  <p className="mt-1 text-slate-500">{new Date(event.occurred_at).toLocaleString()}</p>
                </div>
                <AdminStatus tone={event.action === "granted" ? "success" : "danger"}>{event.action}</AdminStatus>
                <p className="text-slate-600">{actor ? `By ${displayName(actor)}` : "System bootstrap"}{event.note ? ` · ${event.note}` : ""}</p>
              </div>
            );
          })}
        </div>
      </details>
    </AdminPage>
  );
}
