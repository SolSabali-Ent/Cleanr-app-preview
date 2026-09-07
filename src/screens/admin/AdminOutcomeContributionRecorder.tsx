import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Beneficiary = {
  outcome_id: string;
  mentor_person_id: string;
  beneficiary_person_id: string;
  beneficiary_name: string | null;
  beneficiary_profile_role: string | null;
  relationship_id: string;
  relationship_started_at: string | null;
};

const BASE_TYPES = ["knowledge", "opportunity_created", "employment_created", "business_created", "leadership"] as const;

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdminOutcomeContributionRecorder({
  opportunityId,
  outcomeId,
  busy,
  onBusy,
  onError,
  onSuccess,
  onRecorded,
}: {
  opportunityId: string;
  outcomeId: string;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onError: (message: string | null) => void;
  onSuccess: (message: string) => void;
  onRecorded: () => Promise<void>;
}) {
  const [type, setType] = useState<string>("knowledge");
  const [evidence, setEvidence] = useState("");
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [beneficiaryId, setBeneficiaryId] = useState("");

  useEffect(() => {
    let active = true;
    void supabase.rpc("get_admin_growth_opportunity_mentorship_beneficiaries", {
      p_opportunity_id: opportunityId,
    }).then(({ data }) => {
      if (!active) return;
      const rows = ((data ?? []) as Beneficiary[]).filter((row) => row.outcome_id === outcomeId);
      setBeneficiaries(rows);
      setBeneficiaryId((current) => current && rows.some((row) => row.beneficiary_person_id === current) ? current : (rows[0]?.beneficiary_person_id ?? ""));
      if (type === "mentorship" && rows.length === 0) setType("knowledge");
    });
    return () => { active = false; };
  }, [opportunityId, outcomeId]);

  const mentorshipAvailable = beneficiaries.length > 0;
  const canSubmit = evidence.trim().length >= 3 && (type !== "mentorship" || Boolean(beneficiaryId));

  async function record() {
    if (!canSubmit || busy) return;
    onBusy(true);
    onError(null);
    const { error } = await supabase.rpc("record_growth_outcome_contribution", {
      p_outcome_id: outcomeId,
      p_contribution_type: type,
      p_evidence_summary: evidence.trim(),
      p_beneficiary_person_id: type === "mentorship" ? beneficiaryId : null,
      p_metadata: {},
    });
    onBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    setEvidence("");
    onSuccess(type === "mentorship"
      ? "Verified mentorship contribution recorded with durable mentee provenance."
      : "Downstream contribution recorded. The value loop now re-enters Collective Capacity.");
    await onRecorded();
  }

  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-white/70 p-3">
      <div className={`grid gap-2 ${type === "mentorship" ? "md:grid-cols-[170px_220px_1fr_auto]" : "md:grid-cols-[180px_1fr_auto]"}`}>
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-900"
        >
          {BASE_TYPES.map((value) => <option key={value} value={value}>{label(value)}</option>)}
          {mentorshipAvailable ? <option value="mentorship">Mentorship</option> : null}
        </select>

        {type === "mentorship" ? (
          <select
            value={beneficiaryId}
            onChange={(event) => setBeneficiaryId(event.target.value)}
            className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-900"
          >
            {beneficiaries.map((beneficiary) => (
              <option key={beneficiary.relationship_id} value={beneficiary.beneficiary_person_id}>
                {beneficiary.beneficiary_name || "Cleanr member"} · active mentee
              </option>
            ))}
          </select>
        ) : null}

        <input
          value={evidence}
          onChange={(event) => setEvidence(event.target.value)}
          placeholder={type === "mentorship" ? "What verified value did the mentorship create?" : "What new value did this completed opportunity create?"}
          className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs text-slate-900"
        />
        <button
          type="button"
          onClick={() => void record()}
          disabled={busy || !canSubmit}
          className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Record contribution
        </button>
      </div>
      {!mentorshipAvailable ? (
        <p className="mt-2 text-[11px] leading-4 text-slate-500">Mentorship appears only when this completed participant has an active, durable mentor→mentee relationship in Cleanr. Referrals stay unavailable here until they have equally strong beneficiary provenance.</p>
      ) : (
        <p className="mt-2 text-[11px] leading-4 text-slate-500">Mentorship beneficiaries are limited to active mentees already connected to this outcome participant. Admin cannot pick an arbitrary person.</p>
      )}
    </div>
  );
}
