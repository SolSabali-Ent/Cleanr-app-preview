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
type IncidentType = "injury" | "property_damage" | "missing_item" | "safety" | "vehicle" | "other";

type IncidentRow = {
  id: string;
  booking_id: string;
  provider_id: string;
  description: string | null;
  incident_type: IncidentType;
  occurred_at: string | null;
  immediate_danger: boolean;
  status: IncidentStatus;
  created_at: string;
};

type IncidentImageRow = {
  id: string;
  image_path: string | null;
  created_at: string;
};

type EvidenceImage = {
  id: string;
  path: string;
  url: string;
};

const TYPE_LABELS: Record<IncidentType, string> = {
  injury: "Injury",
  property_damage: "Property damage",
  missing_item: "Missing item concern",
  safety: "Safety concern",
  vehicle: "Vehicle / travel incident",
  other: "Other",
};

export function AdminIncidentPanel() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evidenceImages, setEvidenceImages] = useState<EvidenceImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("incidents")
      .select("id,booking_id,provider_id,description,incident_type,occurred_at,immediate_danger,status,created_at")
      .in("status", ["submitted", "under_review"])
      .order("immediate_danger", { ascending: false })
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

  useEffect(() => {
    let active = true;
    setEvidenceImages([]);
    if (!selectedId) return () => { active = false; };

    setEvidenceLoading(true);
    async function loadEvidence() {
      try {
        const { data, error } = await supabase
          .from("incident_images")
          .select("id,image_path,created_at")
          .eq("incident_id", selectedId)
          .order("created_at", { ascending: true });
        if (!active) return;
        if (error) {
          setMessage(error.message);
          return;
        }
        const rows = (data ?? []) as IncidentImageRow[];
        const withPaths = rows.filter((row): row is IncidentImageRow & { image_path: string } => Boolean(row.image_path));
        const signed = await Promise.all(withPaths.map(async (row) => {
          const result = await supabase.storage.from("incident-photos").createSignedUrl(row.image_path, 60 * 10);
          if (result.error || !result.data?.signedUrl) return null;
          return { id: row.id, path: row.image_path, url: result.data.signedUrl } satisfies EvidenceImage;
        }));
        if (active) setEvidenceImages(signed.filter((row): row is EvidenceImage => Boolean(row)));
      } finally {
        if (active) setEvidenceLoading(false);
      }
    }
    void loadEvidence();

    return () => { active = false; };
  }, [selectedId]);

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
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{TYPE_LABELS[incident.incident_type] ?? "Service incident"}</p>
                      {incident.immediate_danger ? <p className="mt-1 text-[11px] font-semibold text-red-700">Immediate safety concern</p> : null}
                    </div>
                    <AdminStatus tone="warning">{incident.status.replace("_", " ")}</AdminStatus>
                  </div>
                  <p className="mt-1 truncate font-mono text-[10px] text-slate-500">Booking {incident.booking_id}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{incident.description || "No description"}</p>
                  <p className="mt-2 text-[11px] text-slate-400">Reported {new Date(incident.created_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          </div>

          {selected ? (
            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Provider-submitted evidence</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-950">{TYPE_LABELS[selected.incident_type] ?? "Incident review"}</h3>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">Booking {selected.booking_id}</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>Reported {new Date(selected.created_at).toLocaleString()}</p>
                  <p className="mt-1 font-mono text-[10px]">CSP {selected.provider_id}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reported occurrence</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{selected.occurred_at ? new Date(selected.occurred_at).toLocaleString() : "Not separately provided"}</p>
                </div>
                <div className={`rounded-xl p-3 ${selected.immediate_danger ? "bg-red-50" : "bg-slate-50"}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Safety triage</p>
                  <p className={`mt-1 text-sm font-medium ${selected.immediate_danger ? "text-red-800" : "text-slate-900"}`}>{selected.immediate_danger ? "Immediate concern reported" : "No immediate danger reported"}</p>
                </div>
              </div>

              <div className="mt-4 border-y border-slate-200 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reporter statement</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selected.description || "No description supplied."}</p>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Photo evidence</p>
                  <span className="text-[11px] text-slate-400">{evidenceImages.length} available</span>
                </div>
                {evidenceLoading ? <p className="mt-2 text-xs text-slate-500">Loading private evidence…</p> : null}
                {!evidenceLoading && evidenceImages.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {evidenceImages.map((image, index) => (
                      <a key={image.id} href={image.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <img src={image.url} alt={`Incident evidence ${index + 1}`} className="aspect-square w-full object-cover" />
                      </a>
                    ))}
                  </div>
                ) : null}
                {!evidenceLoading && evidenceImages.length === 0 ? <p className="mt-2 text-xs text-slate-500">No retrievable photo evidence.</p> : null}
              </div>

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
