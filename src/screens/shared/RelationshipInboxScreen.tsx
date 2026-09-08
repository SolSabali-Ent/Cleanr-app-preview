import { useEffect, useState } from "react";
import { History, MessageCircle, Pause, Play, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getSignedProfilePhotoUrl } from "../../lib/profilePhotoApi";
import { supabase } from "../../lib/supabase";
import {
  updateMyServiceRelationshipStatus,
  type RelationshipAction,
  type RelationshipStatus,
} from "../../lib/relationshipMessagingApi";

type DirectoryRow = {
  service_relationship_id: string;
  relationship_status: RelationshipStatus;
  counterpart_id: string;
  counterpart_name: string;
  counterpart_photo_path: string | null;
  updated_at: string;
};

type RowWithPhoto = DirectoryRow & { photoUrl: string | null };

type StatusHistoryRow = {
  id: string;
  service_relationship_id: string;
  from_status: RelationshipStatus;
  to_status: RelationshipStatus;
  changed_by: string | null;
  changed_by_role: "customer" | "csp" | "system" | "admin";
  reason: string | null;
  created_at: string;
};

type PendingChange = {
  relationshipId: string;
  action: "pause" | "end";
};

function transitionVerb(status: RelationshipStatus): string {
  if (status === "paused") return "paused";
  if (status === "active") return "resumed";
  return "ended";
}

function formatHistoryDate(value: string): string {
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function RelationshipInboxScreen({ variant }: { variant: "customer" | "csp" }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RowWithPhoto[]>([]);
  const [historyByRelationship, setHistoryByRelationship] = useState<Record<string, StatusHistoryRow[]>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [changeNote, setChangeNote] = useState("");
  const isCsp = variant === "csp";

  const load = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);

    const [{ data: sessionData }, directoryResult] = await Promise.all([
      supabase.auth.getSession(),
      supabase.rpc("get_my_relationship_message_directory"),
    ]);

    const userId = sessionData.session?.user?.id ?? null;
    setCurrentUserId(userId);

    if (directoryResult.error) {
      setError(directoryResult.error.message);
      setRows([]);
      setHistoryByRelationship({});
      if (showSpinner) setLoading(false);
      return;
    }

    const base = (directoryResult.data ?? []) as DirectoryRow[];
    const relationshipIds = base.map((row) => row.service_relationship_id);

    const [enriched, historyResult] = await Promise.all([
      Promise.all(base.map(async (row) => ({
        ...row,
        photoUrl: await getSignedProfilePhotoUrl(row.counterpart_photo_path),
      }))),
      relationshipIds.length > 0
        ? supabase
            .from("service_relationship_status_history")
            .select("id,service_relationship_id,from_status,to_status,changed_by,changed_by_role,reason,created_at")
            .in("service_relationship_id", relationshipIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as StatusHistoryRow[], error: null }),
    ]);

    if (historyResult.error) setError(historyResult.error.message);

    const grouped: Record<string, StatusHistoryRow[]> = {};
    for (const event of (historyResult.data ?? []) as StatusHistoryRow[]) {
      const current = grouped[event.service_relationship_id] ?? [];
      current.push(event);
      grouped[event.service_relationship_id] = current;
    }

    setRows(enriched);
    setHistoryByRelationship(grouped);
    if (showSpinner) setLoading(false);
  };

  useEffect(() => {
    let active = true;
    async function initialLoad() {
      try {
        await load(true);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Could not load relationships.");
          setLoading(false);
        }
      }
    }
    void initialLoad();
    return () => { active = false; };
  }, []);

  const openThread = (relationshipId: string) => {
    navigate(isCsp ? `/csp/dashboard/relationships/${relationshipId}/message` : `/app/relationships/${relationshipId}/message`);
  };

  const beginChange = (relationshipId: string, action: "pause" | "end") => {
    setPendingChange({ relationshipId, action });
    setChangeNote("");
    setError(null);
  };

  const cancelChange = () => {
    setPendingChange(null);
    setChangeNote("");
  };

  const updateRelationship = async (row: RowWithPhoto, action: RelationshipAction, reason?: string) => {
    if (busyId) return;
    setBusyId(row.service_relationship_id);
    setError(null);
    try {
      await updateMyServiceRelationshipStatus(row.service_relationship_id, action, reason);
      cancelChange();
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this relationship.");
      await load(false).catch(() => {});
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={isCsp ? "pb-24 text-white" : "pb-24 text-[#0B1220]"}>
      <header className="mb-5">
        <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isCsp ? "text-emerald-300" : "text-[#166534]"}`}>Relationships</p>
        <h1 className="mt-2 text-2xl font-semibold">Messages</h1>
        <p className={`mt-2 text-sm leading-6 ${isCsp ? "text-white/60" : "text-[#667085]"}`}>
          Established customer–CSP relationships can stay connected between bookings. Either person can pause or end the relationship without deleting shared history. A pause stays in place until the person who initiated it resumes it.
        </p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-500">{error}</p> : null}

      {loading ? <p className="text-sm opacity-65">Loading relationships…</p> : rows.length === 0 ? (
        <div className={`rounded-2xl border p-5 text-sm ${isCsp ? "border-white/10 bg-white/5 text-white/60" : "border-[#E5E7EB] bg-white text-[#667085]"}`}>
          No established relationships to message yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const busy = busyId === row.service_relationship_id;
            const history = historyByRelationship[row.service_relationship_id] ?? [];
            const pending = pendingChange?.relationshipId === row.service_relationship_id ? pendingChange : null;
            const currentPause = row.relationship_status === "paused"
              ? history.find((event) => event.to_status === "paused") ?? null
              : null;
            const pauseOwnedByViewer = Boolean(
              currentPause?.changed_by && currentUserId && currentPause.changed_by === currentUserId
            );
            return (
              <div
                key={row.service_relationship_id}
                className={`rounded-2xl border p-4 ${isCsp ? "border-white/10 bg-white/5" : "border-[#E5E7EB] bg-white shadow-sm"}`}
              >
                <button
                  type="button"
                  onClick={() => openThread(row.service_relationship_id)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full ${isCsp ? "bg-white/10" : "bg-[#F3FAF1]"}`}>
                    {row.photoUrl ? <img src={row.photoUrl} alt="" className="h-full w-full object-cover" /> : <span className="font-semibold">{row.counterpart_name.charAt(0)}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-semibold">{row.counterpart_name}</p>
                      <span className={`text-[11px] capitalize ${row.relationship_status === "active" ? (isCsp ? "text-emerald-300" : "text-[#166534]") : "opacity-55"}`}>{row.relationship_status}</span>
                    </div>
                    <p className={`mt-1 text-xs ${isCsp ? "text-white/55" : "text-[#667085]"}`}>
                      {row.relationship_status === "active" ? "Open relationship conversation" : "History available · new messages disabled"}
                    </p>
                  </div>
                  <MessageCircle size={18} className="shrink-0 opacity-70" />
                </button>

                <div className={`mt-4 flex flex-wrap items-center gap-2 border-t pt-3 ${isCsp ? "border-white/10" : "border-[#E5E7EB]"}`}>
                  {row.relationship_status === "active" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => beginChange(row.service_relationship_id, "pause")}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isCsp ? "border-white/10 bg-white/5" : "border-[#D0D5DD] bg-white"}`}
                    >
                      <Pause className="h-3.5 w-3.5" /> Pause relationship
                    </button>
                  ) : row.relationship_status === "paused" && pauseOwnedByViewer ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateRelationship(row, "resume")}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isCsp ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-[#A6D98A] bg-[#F3FAF1] text-[#166534]"}`}
                    >
                      <Play className="h-3.5 w-3.5" /> Resume relationship
                    </button>
                  ) : row.relationship_status === "paused" ? (
                    <p className={`text-xs leading-5 ${isCsp ? "text-white/50" : "text-[#667085]"}`}>
                      {currentPause?.changed_by ? `${row.counterpart_name} paused this relationship. Only they can resume this pause.` : "This pause can only be resumed by the person who initiated it."}
                    </p>
                  ) : null}

                  {row.relationship_status !== "ended" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => beginChange(row.service_relationship_id, "end")}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-[#B42318] disabled:opacity-50 ${isCsp ? "bg-red-400/10" : "bg-[#FFF1F0]"}`}
                    >
                      <XCircle className="h-3.5 w-3.5" /> End relationship
                    </button>
                  ) : (
                    <p className={`text-xs ${isCsp ? "text-white/45" : "text-[#98A2B3]"}`}>
                      This relationship chapter is ended. Shared history remains available.
                    </p>
                  )}
                </div>

                {pending ? (
                  <div className={`mt-3 rounded-xl border p-3 ${isCsp ? "border-white/10 bg-black/10" : "border-[#E4E7EC] bg-[#F8FAFC]"}`}>
                    <p className="text-sm font-semibold">
                      {pending.action === "pause" ? "Pause this relationship?" : "End this relationship?"}
                    </p>
                    <p className={`mt-1 text-xs leading-5 ${isCsp ? "text-white/55" : "text-[#667085]"}`}>
                      You can add a short note for {row.counterpart_name}, or leave it blank. Any note is shared with both of you in relationship history.
                    </p>
                    {pending.action === "pause" ? (
                      <p className={`mt-1 text-xs leading-5 ${isCsp ? "text-white/45" : "text-[#98A2B3]"}`}>
                        Because you are initiating this pause, only you can resume it later. {row.counterpart_name} can still end the relationship.
                      </p>
                    ) : (
                      <p className={`mt-1 text-xs leading-5 ${isCsp ? "text-white/45" : "text-[#98A2B3]"}`}>
                        Ending the relationship does not cancel a scheduled booking or end a recurring cleaning plan.
                      </p>
                    )}
                    <textarea
                      value={changeNote}
                      onChange={(event) => setChangeNote(event.target.value.slice(0, 280))}
                      placeholder="Optional shared note"
                      rows={3}
                      className={`mt-3 w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none ${isCsp ? "border-white/10 bg-white/5 text-white placeholder:text-white/30" : "border-[#D0D5DD] bg-white text-[#0B1220] placeholder:text-[#98A2B3]"}`}
                    />
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className={`text-[10px] ${isCsp ? "text-white/35" : "text-[#98A2B3]"}`}>{changeNote.length}/280</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={cancelChange}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isCsp ? "text-white/60" : "text-[#667085]"}`}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void updateRelationship(row, pending.action, changeNote)}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${pending.action === "end" ? "bg-[#B42318] text-white" : isCsp ? "bg-white text-[#0B1220]" : "bg-[#0B1220] text-white"}`}
                        >
                          {busy ? "Updating…" : pending.action === "pause" ? "Pause relationship" : "End relationship"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {history.length > 0 ? (
                  <details className={`mt-3 border-t pt-3 ${isCsp ? "border-white/10" : "border-[#E5E7EB]"}`}>
                    <summary className={`flex cursor-pointer list-none items-center gap-2 text-xs font-semibold [&::-webkit-details-marker]:hidden ${isCsp ? "text-white/60" : "text-[#667085]"}`}>
                      <History className="h-3.5 w-3.5" /> Relationship history
                    </summary>
                    <div className="mt-3 space-y-3">
                      {history.map((event) => {
                        const actor = event.changed_by && event.changed_by === currentUserId
                          ? "You"
                          : event.changed_by_role === "admin"
                            ? "Cleanr"
                            : event.changed_by_role === "system"
                              ? "Cleanr system"
                              : row.counterpart_name;
                        return (
                          <div key={event.id} className={`rounded-xl px-3 py-2.5 text-xs ${isCsp ? "bg-white/5 text-white/65" : "bg-[#F8FAFC] text-[#475467]"}`}>
                            <p className="font-medium">
                              {actor} {transitionVerb(event.to_status)} this relationship.
                            </p>
                            <p className={`mt-1 text-[11px] ${isCsp ? "text-white/40" : "text-[#98A2B3]"}`}>
                              {event.from_status} → {event.to_status} · {formatHistoryDate(event.created_at)}
                            </p>
                            {event.reason ? <p className="mt-1.5 leading-5">{event.reason}</p> : null}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
