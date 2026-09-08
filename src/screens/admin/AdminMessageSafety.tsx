import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  AdminDangerButton,
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminPanel,
  AdminSecondaryButton,
  AdminStatus,
  AdminTabs,
} from "./AdminUi";

type SafetyFlag = {
  id: string;
  message_scope: "booking" | "relationship";
  message_id: string;
  thread_id: string;
  booking_id: string | null;
  service_relationship_id: string | null;
  sender_id: string;
  sender_name: string;
  severity: "low" | "medium" | "high";
  categories: string[];
  matched_terms: string[];
  message_excerpt: string;
  status: "open" | "reviewed" | "dismissed" | "escalated";
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type Filter = "open" | "escalated" | "all";

function severityTone(severity: SafetyFlag["severity"]) {
  if (severity === "high") return "danger" as const;
  if (severity === "medium") return "warning" as const;
  return "neutral" as const;
}

export function AdminMessageSafety() {
  const [flags, setFlags] = useState<SafetyFlag[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_admin_message_safety_flags", { p_status: filter });
    if (rpcError) {
      setError(rpcError.message);
      setFlags([]);
    } else {
      setFlags((data ?? []) as SafetyFlag[]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => ({
    high: flags.filter((flag) => flag.severity === "high").length,
    medium: flags.filter((flag) => flag.severity === "medium").length,
  }), [flags]);

  async function resolve(flag: SafetyFlag, status: "reviewed" | "dismissed" | "escalated") {
    if (busyId) return;
    setBusyId(flag.id);
    setError(null);
    const note = notes[flag.id]?.trim() || null;
    const { error: rpcError } = await supabase.rpc("admin_resolve_message_safety_flag", {
      p_flag_id: flag.id,
      p_status: status,
      p_note: note,
    });
    if (rpcError) setError(rpcError.message);
    else await load();
    setBusyId(null);
  }

  return (
    <AdminPage>
      <AdminPageHeader
        eyebrow="Trust & safety"
        title="Message safety"
        description="Review flagged language in context. Flags are signals, not automatic misconduct decisions."
        meta={flags.length > 0 ? <span className="text-xs text-slate-500">{flags.length} in view · {counts.high} high · {counts.medium} medium</span> : undefined}
      />

      <AdminTabs
        value={filter}
        onChange={setFilter}
        items={[
          { value: "open", label: "Open" },
          { value: "escalated", label: "Escalated" },
          { value: "all", label: "All" },
        ]}
      />

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      {loading ? (
        <AdminPanel><p className="text-sm text-slate-500">Loading safety flags…</p></AdminPanel>
      ) : flags.length === 0 ? (
        <AdminEmptyState title={`No ${filter === "all" ? "message safety" : filter} flags`} description="New review signals will appear here when they need attention." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {flags.map((flag, index) => (
            <article key={flag.id} className={`grid gap-4 px-5 py-5 xl:grid-cols-[190px_minmax(0,1fr)_300px] ${index > 0 ? "border-t border-slate-200" : ""}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminStatus tone={severityTone(flag.severity)}>{flag.severity}</AdminStatus>
                  <AdminStatus>{flag.message_scope}</AdminStatus>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">{flag.sender_name}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(flag.created_at).toLocaleString()}</p>
                <p className="mt-3 text-[11px] leading-5 text-slate-500">{flag.categories.join(" · ") || "No category"}</p>
              </div>

              <div className="min-w-0">
                <blockquote className="border-l-2 border-slate-200 pl-4 text-sm leading-6 text-slate-800">{flag.message_excerpt}</blockquote>
                {flag.matched_terms.length > 0 ? <p className="mt-3 text-[11px] text-slate-500">Matched: {flag.matched_terms.join(", ")}</p> : null}
                {flag.review_note ? <p className="mt-3 text-xs leading-5 text-slate-600">Review note: {flag.review_note}</p> : null}
              </div>

              <div className="self-start">
                <input
                  value={notes[flag.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [flag.id]: event.target.value }))}
                  placeholder="Review note"
                  className="min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <AdminSecondaryButton disabled={busyId === flag.id} onClick={() => void resolve(flag, "dismissed")}>Dismiss</AdminSecondaryButton>
                  <AdminSecondaryButton disabled={busyId === flag.id} onClick={() => void resolve(flag, "reviewed")}>Mark reviewed</AdminSecondaryButton>
                  <AdminDangerButton disabled={busyId === flag.id || !(notes[flag.id]?.trim())} onClick={() => void resolve(flag, "escalated")}>Escalate</AdminDangerButton>
                </div>
                <p className="mt-2 text-[11px] text-slate-400">Escalation requires a review note.</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
