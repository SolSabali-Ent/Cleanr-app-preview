import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPanel,
  AdminSecondaryButton,
  AdminSectionHeader,
  AdminStatus,
} from "./AdminUi";

type IncidentStatus = "submitted" | "under_review" | "resolved";

type IncidentRow = {
  id: string;
  booking_id: string;
  provider_id: string;
  description: string | null;
  status: IncidentStatus;
  created_at: string;
};

export function AdminIncidentPanel() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("incidents")
      .select("id,booking_id,provider_id,description,status,created_at")
      .in("status", ["submitted", "under_review"])
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as IncidentRow[];
    setIncidents(rows);
    setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => incidents.find((row) => row.id === selectedId) ?? null, [incidents, selectedId]);

  async function transition(incident: IncidentRow, status: "under_review" | "resolved") {
    if (workingId) return;
    setWorkingId(incident.id);
    setMessage(null);
    try {
      const { error } = await supabase.rpc("transition_incident_status", {
        p_incident_id: incident.id,
        p_status: status,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage(status === "under_review" ? "Incident marked under review. Reporter evidence was not changed." : "Incident marked resolved. Reporter evidence remains preserved.");
      await load();
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section>
      <AdminSectionHeader
        title="Service incidents"
        description="Provider-submitted injury, damage, safety, or other service evidence requiring operator review. Reporter evidence is preserved as submitted."
        actions={<AdminStatus tone={incidents.length > 0 ? "warning" : "success"}>{incidents.length} active</AdminStatus>}
      />

      {message ? <div className="mt-3"><AdminNotice tone="info">{message}</AdminNotice></div> : null}

      {loading ? (
        <AdminPanel className="mt-3"><p className="text-sm text-slate-500">Loading incidents…</p></AdminPanel>
      ) : incidents.length === 0 ? (
        <div className="mt-3"><AdminEmptyState title="No open service incidents" description="Provider incident reports will remain here until an operator reviews and resolves them." /></div>
      ) : (
        <div className="mt-3 grid overflow-hidden rounded-2xl border border-slate-200 bg-white xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="border-b border-slate-200 xl:border-b-0 xl:border-r">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Incident queue</div>
            <div className="divide-y divide-slate-100">
              {incidents.map((incident) => (
                <button
                  key={incident.id}
                  type="button"
                  onClick={() => setSelectedId(incident.id)}
                  className={`w-full px-4 py-4 text-left transition ${incident.id === selectedId ? "bg-blue-50" : "hover:bg-slate-50"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-950">Service incident</p>
                    <AdminStatus tone="warning">{incident.status.replace("_", " ")}</AdminStatus>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-slate-500">Booking {incident.booking_id}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{incident.description || "No description"}</p>
                  <p className="mt-2 text-[11px] text-slate-400">{new Date(incident.created_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>

          {selected ? (
            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Provider-submitted evidence</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">Incident review</h3>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">Booking {selected.booking_id}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{new Date(selected.created_at).toLocaleString()}</p>
                  <p className="mt-1 font-mono text-[10px]">CSP {selected.provider_id}</p>
                </div>
              </div>

              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selected.description || "No description supplied."}</p>

              <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                This queue records and preserves evidence; it does not decide legal fault, insurance coverage, employment status, or claim liability. Use the underlying booking and evidence before taking any external claim action.
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selected.status === "submitted" ? (
                  <AdminSecondaryButton disabled={workingId === selected.id} onClick={() => void transition(selected, "under_review")}>Mark under review</AdminSecondaryButton>
                ) : null}
                <button
                  type="button"
                  disabled={workingId === selected.id}
                  onClick={() => {
                    if (window.confirm("Resolve this incident in Cleanr? The submitted evidence will remain preserved.")) void transition(selected, "resolved");
                  }}
                  className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                >
                  Resolve incident
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
