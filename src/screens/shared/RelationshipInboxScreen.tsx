import { useEffect, useState } from "react";
import { MessageCircle, Pause, Play, XCircle } from "lucide-react";
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

export function RelationshipInboxScreen({ variant }: { variant: "customer" | "csp" }) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<RowWithPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isCsp = variant === "csp";

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("get_my_relationship_message_directory");
    if (rpcError) {
      setError(rpcError.message);
      setRows([]);
      setLoading(false);
      return;
    }
    const base = (data ?? []) as DirectoryRow[];
    const enriched = await Promise.all(base.map(async (row) => ({ ...row, photoUrl: await getSignedProfilePhotoUrl(row.counterpart_photo_path) })));
    setRows(enriched);
    setLoading(false);
  };

  useEffect(() => {
    let active = true;
    async function initialLoad() {
      setLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc("get_my_relationship_message_directory");
      if (!active) return;
      if (rpcError) {
        setError(rpcError.message);
        setRows([]);
        setLoading(false);
        return;
      }
      const base = (data ?? []) as DirectoryRow[];
      const enriched = await Promise.all(base.map(async (row) => ({ ...row, photoUrl: await getSignedProfilePhotoUrl(row.counterpart_photo_path) })));
      if (active) {
        setRows(enriched);
        setLoading(false);
      }
    }
    void initialLoad();
    return () => { active = false; };
  }, []);

  const openThread = (relationshipId: string) => {
    navigate(isCsp ? `/csp/dashboard/relationships/${relationshipId}/message` : `/app/relationships/${relationshipId}/message`);
  };

  const updateRelationship = async (row: RowWithPhoto, action: RelationshipAction) => {
    if (busyId) return;

    if (action === "end") {
      const confirmed = window.confirm(
        `End your Cleanr relationship with ${row.counterpart_name}? Message history and prior bookings will remain available. This does not cancel any scheduled booking or recurring cleaning.`
      );
      if (!confirmed) return;
    }

    setBusyId(row.service_relationship_id);
    setError(null);
    try {
      const status = await updateMyServiceRelationshipStatus(row.service_relationship_id, action);
      setRows((current) => current.map((item) =>
        item.service_relationship_id === row.service_relationship_id
          ? { ...item, relationship_status: status, updated_at: new Date().toISOString() }
          : item
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this relationship.");
      await load().catch(() => {});
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
          Established customer–CSP relationships can stay connected between bookings. Either person can pause, resume, or end the relationship without deleting shared history.
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

                <div className={`mt-4 flex flex-wrap gap-2 border-t pt-3 ${isCsp ? "border-white/10" : "border-[#E5E7EB]"}`}>
                  {row.relationship_status === "active" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateRelationship(row, "pause")}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isCsp ? "border-white/10 bg-white/5" : "border-[#D0D5DD] bg-white"}`}
                    >
                      <Pause className="h-3.5 w-3.5" /> Pause relationship
                    </button>
                  ) : row.relationship_status === "paused" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateRelationship(row, "resume")}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isCsp ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-[#A6D98A] bg-[#F3FAF1] text-[#166534]"}`}
                    >
                      <Play className="h-3.5 w-3.5" /> Resume relationship
                    </button>
                  ) : null}

                  {row.relationship_status !== "ended" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateRelationship(row, "end")}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
