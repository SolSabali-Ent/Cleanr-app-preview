import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

type ExistingOpportunity = {
  source_id: string;
  signal_id: string;
  signal_label: string;
  signal_status: string;
  opportunity_id: string;
  opportunity_type: string;
  opportunity_title: string;
  opportunity_description: string | null;
  opportunity_status: string;
  opportunity_visibility: string;
  geographic_scope: string | null;
  creation_reason: string;
  created_at: string;
};

type Props = {
  circleId: string;
  signalId: string;
  signalLabel: string;
  signalStatus: string;
  onCreated?: () => void | Promise<void>;
};

const OPPORTUNITY_TYPES = [
  "backup_coverage",
  "referral",
  "mentorship",
  "training",
  "leadership",
  "business",
  "vendor",
  "education",
  "external",
  "investment",
];

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdminDemandOpportunityPanel({ circleId, signalId, signalLabel, signalStatus, onCreated }: Props) {
  const [existing, setExisting] = useState<ExistingOpportunity | null>(null);
  const [type, setType] = useState("training");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("matched_only");
  const [geographicScope, setGeographicScope] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligible = signalStatus === "validated" || signalStatus === "exploring";
  const canCreate = eligible && !existing && title.trim().length >= 2 && reason.trim().length >= 3 && !busy;

  async function loadExisting() {
    if (!circleId) return;
    const { data, error: rpcError } = await supabase.rpc("get_admin_circle_demand_opportunities", { p_circle_id: circleId });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const row = ((data ?? []) as ExistingOpportunity[]).find((item) => item.signal_id === signalId) ?? null;
    setExisting(row);
  }

  useEffect(() => { void loadExisting(); }, [circleId, signalId]);

  const existingSummary = useMemo(() => {
    if (!existing) return null;
    return `${humanize(existing.opportunity_type)} · ${humanize(existing.opportunity_status)} · ${humanize(existing.opportunity_visibility)}`;
  }, [existing]);

  async function createOpportunity() {
    if (!canCreate) return;
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("admin_create_growth_opportunity_from_demand", {
      p_signal_id: signalId,
      p_creation_reason: reason.trim(),
      p_opportunity_type: type,
      p_title: title.trim(),
      p_description: description.trim() || null,
      p_visibility: visibility,
      p_geographic_scope: geographicScope.trim() || null,
      p_starts_at: null,
      p_closes_at: null,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await loadExisting();
    await onCreated?.();
  }

  return (
    <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex items-start gap-3">
        <ArrowRight size={16} className="mt-0.5 text-blue-700" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">Demand → opportunity</p>
          <p className="mt-1 text-sm font-semibold text-slate-950">Deliberate opportunity hypothesis</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Create one non-service Growth opportunity only when this repeated need is strong enough to explore. This does not select a person, notify anyone, create a service Job, or create a business.
          </p>
        </div>
      </div>

      {existing ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={15} className="mt-0.5 text-emerald-700" />
            <div>
              <p className="text-xs font-semibold text-emerald-900">Opportunity created from this demand</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{existing.opportunity_title}</p>
              <p className="mt-1 text-xs text-slate-600">{existingSummary}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">Why: {existing.creation_reason}</p>
              {existing.geographic_scope ? <p className="mt-1 text-xs text-slate-500">Scope: {existing.geographic_scope}</p> : null}
            </div>
          </div>
        </div>
      ) : !eligible ? (
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Move this signal to Validated or Exploring before creating an opportunity. Observed demand is evidence gathering; retired demand stays closed.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">Opportunity type
            <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900">
              {OPPORTUNITY_TYPES.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">Visibility
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900">
              <option value="matched_only">Matched only</option>
              <option value="network">Network</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600 md:col-span-2">Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Opportunity responding to: ${signalLabel}`} maxLength={160} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900" />
          </label>
          <label className="text-xs font-semibold text-slate-600 md:col-span-2">Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={3000} placeholder="What is being explored? Keep this bounded and specific." className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Geographic scope
            <input value={geographicScope} onChange={(e) => setGeographicScope(e.target.value)} placeholder="Atlanta metro, remote, etc." className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900" />
          </label>
          <label className="text-xs font-semibold text-slate-600">Why create this opportunity now?
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="What evidence justifies moving from need to opportunity?" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900" />
          </label>
          <div className="md:col-span-2 flex justify-end">
            <button type="button" disabled={!canCreate} onClick={() => void createOpportunity()} className="rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">
              {busy ? "Creating…" : "Create one Growth opportunity"}
            </button>
          </div>
        </div>
      )}

      {error ? <p className="mt-3 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
