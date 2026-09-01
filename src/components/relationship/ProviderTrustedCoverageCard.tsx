import { useEffect, useMemo, useState } from "react";
import { Handshake } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { NetworkConnectionSummary } from "@/domain/network";
import type { TrustedServiceHandoff, TrustedServiceHandoffReason } from "@/domain/trustedHandoff";
import { listMyNetworkRelationships } from "@/lib/networkApi";
import {
  getTrustedServiceHandoffForBooking,
  proposeTrustedServiceHandoff,
  respondToTrustedServiceHandoff,
} from "@/lib/trustedHandoffApi";
import { isOfflinePreviewMode, supabase } from "@/lib/supabase";

interface CoveragePartner {
  relationshipId: string;
  personId: string;
  name: string;
}

const reasonOptions: Array<{ value: TrustedServiceHandoffReason; label: string }> = [
  { value: "availability", label: "Availability conflict" },
  { value: "time_off", label: "Time off" },
  { value: "coverage", label: "Need coverage" },
  { value: "continuity", label: "Protect household continuity" },
  { value: "other", label: "Other" },
];

function otherParticipantId(summary: NetworkConnectionSummary, personId: string): string {
  return summary.relationship.sourcePersonId === personId
    ? summary.relationship.targetPersonId
    : summary.relationship.sourcePersonId;
}

function handoffCopy(handoff: TrustedServiceHandoff): string {
  if (handoff.status === "completed") {
    return "The trusted backup became the formal provider for this booking and the household confirmed the completed service.";
  }
  if (handoff.status === "active" && handoff.fulfillmentAppliedAt) {
    return "Cleanr has formally reconciled this booking to your trusted backup. The residential service engine owns fulfillment from here.";
  }
  if (handoff.status === "active") {
    return "Your trusted backup and the household both agreed. The trust transfer is active; formal booking assignment is still waiting on Cleanr operations.";
  }
  if (handoff.backupAcceptedAt && !handoff.customerConfirmedAt) {
    return "Your backup agreed to cover. The household still needs to approve the handoff.";
  }
  if (handoff.customerConfirmedAt && !handoff.backupAcceptedAt) {
    return "The household approved the backup. Waiting for the backup CSP to accept.";
  }
  return "Coverage requested. Nothing changes until the backup CSP and household both agree.";
}

export function ProviderTrustedCoverageCard({ bookingId }: { bookingId: string }) {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<CoveragePartner[]>([]);
  const [handoff, setHandoff] = useState<TrustedServiceHandoff | null>(null);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [reason, setReason] = useState<TrustedServiceHandoffReason>("availability");
  const [reasonNote, setReasonNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (isOfflinePreviewMode) return;

    const [{ data: authData, error: authError }, currentHandoff, connections] = await Promise.all([
      supabase.auth.getUser(),
      getTrustedServiceHandoffForBooking(bookingId),
      listMyNetworkRelationships(),
    ]);
    if (authError) throw authError;

    const personId = authData.user?.id;
    setHandoff(currentHandoff);
    if (!personId) {
      setPartners([]);
      return;
    }

    const coverageRelationships = connections.filter(({ relationship }) =>
      relationship.type === "coverage_partner" && relationship.status === "active"
    );
    const participantIds = coverageRelationships.map((summary) => otherParticipantId(summary, personId));

    const names = new Map<string, string>();
    if (participantIds.length > 0) {
      const { data } = await supabase
        .from("provider_public_profiles")
        .select("id, full_name")
        .in("id", participantIds);

      for (const row of data ?? []) {
        if (typeof row.id === "string") {
          const name = typeof row.full_name === "string" && row.full_name.trim()
            ? row.full_name.trim()
            : "Trusted Cleanr CSP";
          names.set(row.id, name);
        }
      }
    }

    const nextPartners = coverageRelationships.map((summary) => {
      const otherId = otherParticipantId(summary, personId);
      return {
        relationshipId: summary.relationship.id,
        personId: otherId,
        name: names.get(otherId) ?? "Trusted Cleanr CSP",
      };
    });
    setPartners(nextPartners);
    setSelectedPartnerId((current) => current || nextPartners[0]?.personId || "");
  }

  useEffect(() => {
    let active = true;
    if (isOfflinePreviewMode) return;
    void refresh().catch((err) => {
      if (active) setError(err instanceof Error ? err.message : "Trusted coverage is temporarily unavailable.");
    });
    return () => { active = false; };
  }, [bookingId]);

  const selectedPartner = useMemo(
    () => partners.find((partner) => partner.personId === selectedPartnerId) ?? null,
    [partners, selectedPartnerId]
  );

  async function requestCoverage() {
    if (!selectedPartner || busy) return;
    try {
      setBusy(true);
      setError(null);
      const created = await proposeTrustedServiceHandoff({
        bookingId,
        toProviderId: selectedPartner.personId,
        coverageRelationshipId: selectedPartner.relationshipId,
        reason,
        reasonNote: reasonNote.trim() || null,
      });
      setHandoff(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request trusted coverage.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelCoverage() {
    if (!handoff || busy) return;
    try {
      setBusy(true);
      setError(null);
      await respondToTrustedServiceHandoff(handoff.id, "cancel");
      setHandoff(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel trusted coverage.");
    } finally {
      setBusy(false);
    }
  }

  if (isOfflinePreviewMode) return null;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md text-slate-900">
      <div className="flex items-start gap-3">
        <Handshake className="h-5 w-5 text-[#8DCC64] mt-0.5" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-500">Trusted coverage</p>
          <p className="mt-1 text-sm font-semibold">Protect the household relationship when you cannot make this visit.</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            You can ask an existing coverage partner to step in. The backup CSP and household must both agree before the trust transfer becomes active.
          </p>
        </div>
      </div>

      {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

      {handoff ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-emerald-900">Coverage in progress</p>
            <span className="text-[11px] capitalize text-emerald-800">{handoff.status.replaceAll("_", " ")}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-emerald-800">{handoffCopy(handoff)}</p>
          {handoff.status !== "active" && handoff.status !== "completed" ? (
            <button type="button" disabled={busy} onClick={() => void cancelCoverage()} className="mt-3 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-50">
              Cancel coverage request
            </button>
          ) : null}
        </div>
      ) : partners.length === 0 ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium">No trusted coverage partner yet.</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Coverage begins with a real, mutual relationship—not an automatic substitute assignment.</p>
          <button type="button" onClick={() => navigate("/csp/growth/network")} className="mt-3 text-xs font-semibold text-slate-900 underline underline-offset-2">
            View my Network
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Trusted backup</span>
            <select value={selectedPartnerId} onChange={(event) => setSelectedPartnerId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
              {partners.map((partner) => <option key={partner.relationshipId} value={partner.personId}>{partner.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Why coverage is needed</span>
            <select value={reason} onChange={(event) => setReason(event.target.value as TrustedServiceHandoffReason)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
              {reasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Optional context</span>
            <textarea value={reasonNote} maxLength={500} rows={2} onChange={(event) => setReasonNote(event.target.value)} placeholder="Only what the backup and household need to understand the coverage request." className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm" />
          </label>
          <button type="button" disabled={!selectedPartner || busy} onClick={() => void requestCoverage()} className="w-full rounded-xl bg-[#8DCC64] px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
            {busy ? "Requesting..." : "Ask for trusted coverage"}
          </button>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-4 text-slate-500">
        Requesting coverage never reassigns a booking by itself. Only after the backup CSP and household both consent can Cleanr formally reconcile assignment to the trusted backup; fulfillment then stays inside the normal residential service engine.
      </p>
    </section>
  );
}