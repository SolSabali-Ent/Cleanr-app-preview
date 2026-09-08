import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { AdminNotice, AdminPrimaryButton, AdminStatus } from "./AdminUi";

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

  if (existing) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><p className="text-xs font-semibold text-emerald-900">Opportunity created</p><AdminStatus tone="success">{humanize(existing.opportunity_status)}</AdminStatus></div>
            <p className="mt-1 text-sm font-semibold text-slate-950">{existing.opportunity_title}</p>
            <p className="mt-1 text-xs text-slate-600">{existingSummary}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-emerald-700" aria-hidden />
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">{existing.creation_reason}</p>
        {existing.geographic_scope ? <p className="mt-1 text-xs text-slate-500">Scope: {existing.geographic_scope}</p> : null}
      </div>
    );
  }

  return (
    <details className="mt-4 rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-900">Create opportunity from this demand</p>
            <p className="mt-1 text-xs text-slate-500">A deliberate hypothesis only; no person is selected or notified here.</p>
          </div>
          <AdminStatus tone={eligible ? "info" : "neutral"}>{eligible ? "Eligible" : humanize(signalStatus)}</AdminStatus>
        </div>
      </summary>

      <div className="border-t border-slate-200 px-4 py-4">
        {!eligible ? (
          <p className="text-xs leading-5 text-slate-500">Move this signal to Validated or Exploring before creating an opportunity. Observed demand remains evidence gathering; retired demand stays closed.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">Opportunity type
              <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400">
                {OPPORTUNITY_TYPES.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">Visibility
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400">
                <option value="matched_only">Matched only</option>
                <option value="network">Network</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600 md:col-span-2">Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Opportunity responding to: ${signalLabel}`} maxLength={160} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400" />
            </label>
            <label className="text-xs font-semibold text-slate-600 md:col-span-2">Description
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={3000} placeholder="What is being explored? Keep this bounded and specific." className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400" />
            </label>
            <label className="text-xs font-semibold text-slate-600">Geographic scope
              <input value={geographicScope} onChange={(e) => setGeographicScope(e.target.value)} placeholder="Atlanta metro, remote, etc." className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400" />
            </label>
            <label className="text-xs font-semibold text-slate-600">Why now?
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="What evidence justifies moving from need to opportunity?" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400" />
            </label>
            <div className="flex justify-end md:col-span-2">
              <AdminPrimaryButton disabled={!canCreate} onClick={() => void createOpportunity()}>{busy ? "Creating…" : "Create Growth opportunity"}</AdminPrimaryButton>
            </div>
          </div>
        )}
        {error ? <div className="mt-3"><AdminNotice tone="danger">{error}</AdminNotice></div> : null}
      </div>
    </details>
  );
}
