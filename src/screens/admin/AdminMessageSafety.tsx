import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

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

export function AdminMessageSafety() {
  const [flags, setFlags] = useState<SafetyFlag[]>([]);
  const [filter, setFilter] = useState<"open" | "all" | "escalated">("open");
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
    <div className="space-y-6 text-slate-900">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Trust & Safety</p>
        <h1 className="mt-2 text-3xl font-semibold">Message Safety</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Flagged language is a review signal, not an automatic misconduct decision. Messages still deliver normally; context belongs in human review.
        </p>
      </header>

      <div className="flex gap-2">
        {(["open", "escalated", "all"] as const).map((value) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-4 py-2 text-sm font-medium ${filter === value ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            {value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <p className="text-sm text-slate-500">Loading safety flags…</p> : flags.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No {filter === "all" ? "message safety" : filter} flags.</div>
      ) : (
        <div className="space-y-4">
          {flags.map((flag) => (
            <article key={flag.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${flag.severity === "high" ? "bg-red-100 text-red-700" : flag.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{flag.severity}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{flag.message_scope}</span>
                    <span className="text-xs text-slate-500">{new Date(flag.created_at).toLocaleString()}</span>
                  </div>
                  <h2 className="mt-3 text-base font-semibold">{flag.sender_name}</h2>
                  <p className="mt-1 text-xs text-slate-500">Categories: {flag.categories.join(", ") || "—"} · matched: {flag.matched_terms.join(", ") || "—"}</p>
                </div>
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{flag.status}</span>
              </div>

              <blockquote className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">{flag.message_excerpt}</blockquote>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                <input value={notes[flag.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [flag.id]: event.target.value }))} placeholder="Review note (required to escalate)" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                <div className="flex flex-wrap gap-2">
                  <button disabled={busyId === flag.id} onClick={() => void resolve(flag, "dismissed")} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium">Dismiss</button>
                  <button disabled={busyId === flag.id} onClick={() => void resolve(flag, "reviewed")} className="rounded-xl border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700">Reviewed</button>
                  <button disabled={busyId === flag.id} onClick={() => void resolve(flag, "escalated")} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white">Escalate</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
