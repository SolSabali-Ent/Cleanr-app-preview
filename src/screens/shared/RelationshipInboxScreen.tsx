import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getSignedProfilePhotoUrl } from "../../lib/profilePhotoApi";
import { supabase } from "../../lib/supabase";

type DirectoryRow = {
  service_relationship_id: string;
  relationship_status: "active" | "paused" | "ended";
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
  const isCsp = variant === "csp";

  useEffect(() => {
    let active = true;
    async function load() {
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
    void load();
    return () => { active = false; };
  }, []);

  const openThread = (relationshipId: string) => {
    navigate(isCsp ? `/csp/dashboard/relationships/${relationshipId}/message` : `/app/relationships/${relationshipId}/message`);
  };

  return (
    <div className={isCsp ? "pb-24 text-white" : "pb-24 text-[#0B1220]"}>
      <header className="mb-5">
        <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${isCsp ? "text-emerald-300" : "text-[#166534]"}`}>Relationships</p>
        <h1 className="mt-2 text-2xl font-semibold">Messages</h1>
        <p className={`mt-2 text-sm leading-6 ${isCsp ? "text-white/60" : "text-[#667085]"}`}>
          Established customer–CSP relationships can stay connected between bookings. Cleanr governs who can open the channel, not ordinary conversation inside it.
        </p>
      </header>

      {loading ? <p className="text-sm opacity-65">Loading relationships…</p> : error ? <p className="text-sm text-red-500">{error}</p> : rows.length === 0 ? (
        <div className={`rounded-2xl border p-5 text-sm ${isCsp ? "border-white/10 bg-white/5 text-white/60" : "border-[#E5E7EB] bg-white text-[#667085]"}`}>
          No established relationships to message yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <button
              key={row.service_relationship_id}
              type="button"
              onClick={() => openThread(row.service_relationship_id)}
              className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${isCsp ? "border-white/10 bg-white/5" : "border-[#E5E7EB] bg-white shadow-sm"}`}
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
          ))}
        </div>
      )}
    </div>
  );
}
