import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useIsAdmin } from "../../lib/useIsAdmin";
import { adminTheme } from "../../theme/adminTheme";

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

    if (eventResult.error) {
      setMessage(eventResult.error.message);
      setCandidates((candidateResult.data ?? []) as CandidateRow[]);
      setEvents([]);
      setLoading(false);
      return;
    }

    setCandidates((candidateResult.data ?? []) as CandidateRow[]);
    setEvents((eventResult.data ?? []) as AdminEventRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin]);

  const candidateMap = useMemo(
    () => new Map(candidates.map((candidate) => [candidate.user_id, candidate])),
    [candidates]
  );

  async function grant(candidate: CandidateRow) {
    const note = window.prompt(
      `Why should ${displayName(candidate)} receive platform admin access?`,
      "Independent provider reviewer"
    );
    if (note === null) return;

    setWorkingUserId(candidate.user_id);
    setMessage(null);
    const { error } = await supabase.rpc("admin_grant_platform_admin", {
      p_user_id: candidate.user_id,
      p_note: note,
    });
    setWorkingUserId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`Platform admin access granted to ${displayName(candidate)}.`);
    await load();
  }

  async function revoke(candidate: CandidateRow) {
    const note = window.prompt(
      `Why are you revoking platform admin access from ${displayName(candidate)}?`,
      "Access no longer required"
    );
    if (note === null) return;

    setWorkingUserId(candidate.user_id);
    setMessage(null);
    const { error } = await supabase.rpc("admin_revoke_platform_admin", {
      p_user_id: candidate.user_id,
      p_note: note,
    });
    setWorkingUserId(null);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(`Platform admin access revoked from ${displayName(candidate)}.`);
    await load();
  }

  if (adminLoading) {
    return <p className="text-sm" style={{ color: adminTheme.textSecondary }}>Loading admin session…</p>;
  }

  if (!isAdmin) {
    return <p className="text-sm" style={{ color: adminTheme.textSecondary }}>Admin access required.</p>;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>Admin Access</h1>
        <p className="mt-1 text-sm" style={{ color: adminTheme.textSecondary }}>
          Platform authority is separate from a person&apos;s primary customer or CSP role. Grant only the access needed for trusted operational work.
        </p>
      </header>

      {message ? (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface, color: adminTheme.textPrimary }}
        >
          {message}
        </div>
      ) : null}

      <section className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold">People with Cleanr accounts</h2>
            <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>
              A second independent admin is required to review a CSP who also holds admin authority. The database prevents self-review and prevents removing the last remaining admin authority.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border px-3 py-2 text-xs font-semibold"
            style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm" style={{ color: adminTheme.textSecondary }}>Loading accounts…</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm" style={{ color: adminTheme.textSecondary }}>No Cleanr accounts found.</p>
          ) : (
            candidates.map((candidate) => {
              const isCurrentUser = candidate.user_id === userId;
              const isWorking = workingUserId === candidate.user_id;
              return (
                <div key={candidate.user_id} className="rounded-lg border p-3" style={{ borderColor: adminTheme.border }}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{displayName(candidate)}</p>
                        {isCurrentUser ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">You</span> : null}
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${candidate.has_admin_authority ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                        >
                          {candidate.has_admin_authority ? "Platform admin" : "Standard access"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>
                        Primary role: {candidate.primary_role ?? "—"}{candidate.email ? ` · ${candidate.email}` : ""}
                      </p>
                      {candidate.membership_granted_at ? (
                        <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>
                          Membership granted {new Date(candidate.membership_granted_at).toLocaleString()}
                          {candidate.membership_note ? ` · ${candidate.membership_note}` : ""}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {candidate.has_admin_authority ? (
                        <button
                          type="button"
                          disabled={isWorking || candidate.primary_role === "admin"}
                          onClick={() => void revoke(candidate)}
                          className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ backgroundColor: adminTheme.danger }}
                          title={candidate.primary_role === "admin" ? "Legacy admin-role authority cannot be removed from this membership screen." : "Revoke platform admin membership"}
                        >
                          {isWorking ? "Working…" : "Revoke access"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isWorking}
                          onClick={() => void grant(candidate)}
                          className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ backgroundColor: adminTheme.primary }}
                        >
                          {isWorking ? "Working…" : "Grant admin access"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
        <h2 className="text-sm font-semibold">Access history</h2>
        <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>
          Grants and revocations remain in the audit trail even after membership changes.
        </p>

        <div className="mt-3 space-y-2">
          {events.length === 0 ? (
            <p className="text-sm" style={{ color: adminTheme.textSecondary }}>No access events yet.</p>
          ) : (
            events.map((event) => {
              const subject = candidateMap.get(event.user_id);
              const actor = event.actor_id ? candidateMap.get(event.actor_id) : null;
              return (
                <div key={event.id} className="rounded-lg border px-3 py-2" style={{ borderColor: adminTheme.border }}>
                  <p className="text-xs font-semibold">
                    {displayName(subject ?? { user_id: event.user_id, email: null, full_name: null, primary_role: null, has_admin_authority: false, membership_granted_at: null, membership_granted_by: null, membership_note: null })} · {event.action}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>
                    {new Date(event.occurred_at).toLocaleString()}
                    {actor ? ` · by ${displayName(actor)}` : " · system bootstrap"}
                    {event.note ? ` · ${event.note}` : ""}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
