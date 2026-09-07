import { useEffect, useState } from "react";
import { MessageCircle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

type DirectoryRow = { service_relationship_id: string; relationship_status: string };

export function RelationshipMessagesHomeCard({ variant }: { variant: "customer" | "csp" }) {
  const navigate = useNavigate();
  const [count, setCount] = useState<number | null>(null);
  const isCsp = variant === "csp";

  useEffect(() => {
    let active = true;
    supabase.rpc("get_my_relationship_message_directory").then(({ data, error }) => {
      if (!active) return;
      if (error) setCount(null);
      else setCount(((data ?? []) as DirectoryRow[]).filter((row) => row.relationship_status !== "ended").length);
    });
    return () => { active = false; };
  }, []);

  if (!count) return null;

  return (
    <section className={isCsp ? "mb-6" : "mx-4 mb-5"}>
      <button
        type="button"
        onClick={() => navigate(isCsp ? "/csp/dashboard/relationships" : "/app/relationships")}
        className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left ${isCsp ? "border-white/10 bg-white/5 text-white" : "border-[#E5E7EB] bg-white text-[#0B1220] shadow-sm"}`}
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isCsp ? "bg-emerald-400/10 text-emerald-300" : "bg-[#F3FAF1] text-[#166534]"}`}>
          <MessageCircle size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Relationship messages</p>
          <p className={`mt-1 text-xs leading-5 ${isCsp ? "text-white/55" : "text-[#667085]"}`}>
            {count} established connection{count === 1 ? "" : "s"} · conversations can continue between bookings.
          </p>
        </div>
        <ArrowRight size={17} className="shrink-0 opacity-60" />
      </button>
    </section>
  );
}
