import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Handshake, Home, Network, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { NetworkConnectionSummary, NetworkRelationship } from "@/domain/network";
import { myNetworkConsent, myNetworkRole } from "@/domain/network";
import type { ProviderHouseholdRelationshipSummary } from "@/domain/serviceRelationship";
import type { TrustedServiceHandoffSummary } from "@/domain/trustedHandoff";
import { isOfflinePreviewMode } from "@/lib/supabase";
import { listMyNetworkRelationships, respondToNetworkRelationship } from "@/lib/networkApi";
import { listMyHouseholdContinuity } from "@/lib/serviceRelationshipApi";
import { listMyTrustedServiceHandoffs, respondToTrustedServiceHandoff } from "@/lib/trustedHandoffApi";
import {
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SURFACE,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

type NetworkView = "households" | "coverage" | "connections";

function relationshipLabel(type: NetworkRelationship["type"]): string {
  switch (type) {
    case "mentor": return "Experience connection";
    case "coverage_partner": return "Coverage partner";
    case "business_collaborator": return "Business collaborator";
    default: return "Peer connection";
  }
}

function provenanceLabel(relationship: NetworkRelationship): string {
  switch (relationship.provenanceType) {
    case "opportunity_match": return "Matched opportunity";
    case "booking": return "Service history";
    case "referral": return "Referral";
    default: return "Cleanr introduction";
  }
}

function formatContinuityDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function continuitySourceLabel(summary: ProviderHouseholdRelationshipSummary): string {
  if (summary.relationship?.status === "paused") return "Paused";
  return summary.source === "durable_relationship" ? "Relationship" : "History";
}

function coverageReasonLabel(reason: TrustedServiceHandoffSummary["handoff"]["reason"]): string {
  switch (reason) {
    case "time_off": return "Time off";
    case "availability": return "Availability";
    case "continuity": return "Continuity";
    case "coverage": return "Coverage";
    default: return "Coverage need";
  }
}

function handoffStatusLabel(summary: TrustedServiceHandoffSummary): string {
  const { handoff } = summary;
  if (handoff.status === "active" && handoff.fulfillmentAppliedAt) return "Backup assigned";
  if (handoff.status === "active") return "Agreed";
  if (handoff.status === "backup_accepted") return "Waiting on household";
  if (handoff.status === "customer_confirmed") return "Waiting on backup";
  return "Pending";
}

function handoffStatusCopy(summary: TrustedServiceHandoffSummary): string {
  const { handoff, viewerRole } = summary;
  if (handoff.status === "active" && handoff.fulfillmentAppliedAt) return "The trusted backup is assigned to this visit.";
  if (handoff.status === "active") return "Everyone agreed. Cleanr is finishing the booking handoff.";
  if (viewerRole === "backup_provider") {
    if (handoff.backupAcceptedAt && !handoff.customerConfirmedAt) return "You agreed. Waiting for the household.";
    if (handoff.customerConfirmedAt && !handoff.backupAcceptedAt) return "The household agreed. Your decision is next.";
    return "You were asked to cover one visit.";
  }
  if (handoff.backupAcceptedAt && !handoff.customerConfirmedAt) return "Your backup agreed. Waiting for the household.";
  if (handoff.customerConfirmedAt && !handoff.backupAcceptedAt) return "The household agreed. Waiting for the backup CSP.";
  return "Waiting for the backup CSP and household to agree.";
}

function handoffBoundaryCopy(summary: TrustedServiceHandoffSummary): string {
  const { handoff } = summary;
  if (handoff.fulfillmentAppliedAt) return "The booking now follows normal Jobs rules with the assigned backup.";
  if (handoff.status === "active") return "Agreement does not change the booking until Cleanr applies the handoff.";
  return "This request does not change the booking until everyone agrees and Cleanr applies the handoff.";
}

export default function NetworkScreen() {
  const navigate = useNavigate();
  const [view, setView] = useState<NetworkView>("households");
  const [connections, setConnections] = useState<NetworkConnectionSummary[]>([]);
  const [handoffs, setHandoffs] = useState<TrustedServiceHandoffSummary[]>([]);
  const [households, setHouseholds] = useState<ProviderHouseholdRelationshipSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyHandoffId, setBusyHandoffId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      const [networkRelationships, trustedHandoffs, householdContinuity] = await Promise.all([
        listMyNetworkRelationships(),
        listMyTrustedServiceHandoffs(),
        listMyHouseholdContinuity(),
      ]);
      setConnections(networkRelationships);
      setHandoffs(trustedHandoffs);
      setHouseholds(householdContinuity);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your network");
    }
  }

  useEffect(() => { void refresh(); }, []);

  const active = useMemo(() => connections.filter(({ relationship }) => relationship.status === "active"), [connections]);
  const pending = useMemo(() => connections.filter(({ relationship }) => ["suggested", "requested"].includes(relationship.status)), [connections]);
  const coveragePartners = useMemo(() => active.filter(({ relationship }) => relationship.type === "coverage_partner"), [active]);
  const liveHandoffs = useMemo(() => handoffs.filter(({ handoff }) => ["proposed", "backup_accepted", "customer_confirmed", "active"].includes(handoff.status)), [handoffs]);
  const repeatHouseholds = useMemo(() => households.filter((household) => household.completedServicesCount >= 2), [households]);
  const scheduledHouseholds = useMemo(() => households.filter((household) => Boolean(household.nextScheduledAt)), [households]);

  async function respond(id: string, response: "accept" | "decline" | "end") {
    if (isOfflinePreviewMode || busyId) return;
    try {
      setBusyId(id);
      setError(null);
      await respondToNetworkRelationship(id, response);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update this relationship");
    } finally {
      setBusyId(null);
    }
  }

  async function respondToHandoff(id: string, response: "accept" | "decline" | "cancel") {
    if (isOfflinePreviewMode || busyHandoffId) return;
    try {
      setBusyHandoffId(id);
      setError(null);
      await respondToTrustedServiceHandoff(id, response);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update trusted coverage");
    } finally {
      setBusyHandoffId(null);
    }
  }

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate("/csp/growth")} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <ArrowLeft size={16} /> Growth
      </button>

      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Network</h1>
        <p className="mt-1 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>The people and households connected to your work.</p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <div className="mb-5 grid grid-cols-3 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {([
          ["households", "Households"],
          ["coverage", "Coverage"],
          ["connections", "Connections"],
        ] as Array<[NetworkView, string]>).map(([value, label]) => {
          const selected = view === value;
          const count = value === "households" ? households.length : value === "coverage" ? liveHandoffs.length : pending.length + active.length;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              className="rounded-lg px-2 py-2 text-xs font-semibold transition"
              style={{ backgroundColor: selected ? CSP_SURFACE : "transparent", color: selected ? CSP_TEXT_PRIMARY : CSP_TEXT_SECONDARY }}
            >
              {label}{!isOfflinePreviewMode && count > 0 ? ` · ${count}` : ""}
            </button>
          );
        })}
      </div>

      {view === "households" ? (
        <section>
          {!isOfflinePreviewMode && households.length > 0 ? (
            <div className="mb-4 flex items-center gap-4 border-y border-white/10 py-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
              <span><strong style={{ color: CSP_TEXT_PRIMARY }}>{repeatHouseholds.length}</strong> repeat</span>
              <span><strong style={{ color: CSP_TEXT_PRIMARY }}>{scheduledHouseholds.length}</strong> upcoming</span>
            </div>
          ) : null}

          {households.length === 0 ? (
            <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
              <div className="flex items-start gap-3">
                <Home size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
                <div>
                  <p className="text-sm font-medium">No household relationships yet.</p>
                  <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Households appear here as you work together.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {households.map((household, index) => {
                const lastServed = formatContinuityDate(household.lastServedAt);
                const nextVisit = formatContinuityDate(household.nextScheduledAt);
                const activeDurableRelationship = household.relationship?.status === "active";
                return (
                  <div key={`${household.customerId}-${index}`} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{household.householdLabel}</p>
                        <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{household.completedServicesCount} service{household.completedServicesCount === 1 ? "" : "s"} together</p>
                      </div>
                      <span className="text-[11px]" style={{ color: activeDurableRelationship ? CSP_PRIMARY_BUTTON : CSP_TEXT_SECONDARY }}>{continuitySourceLabel(household)}</span>
                    </div>
                    {(lastServed || nextVisit) ? (
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                        {lastServed ? <span>Last: {lastServed}</span> : null}
                        {nextVisit ? <span>Next: {nextVisit}</span> : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {view === "coverage" ? (
        <section>
          <div className="mb-4 flex items-center justify-between border-y border-white/10 py-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
            <span><strong style={{ color: CSP_TEXT_PRIMARY }}>{isOfflinePreviewMode ? "—" : coveragePartners.length}</strong> coverage partner{coveragePartners.length === 1 ? "" : "s"}</span>
            <span><strong style={{ color: CSP_TEXT_PRIMARY }}>{isOfflinePreviewMode ? "—" : liveHandoffs.length}</strong> active request{liveHandoffs.length === 1 ? "" : "s"}</span>
          </div>

          {liveHandoffs.length === 0 ? (
            <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
              <div className="flex items-start gap-3">
                <Handshake size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
                <div>
                  <p className="text-sm font-medium">No coverage requests right now.</p>
                  <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Trusted backups appear here when a specific visit needs coverage.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {liveHandoffs.map((summary) => {
                const { handoff, viewerRole } = summary;
                const backupNeedsDecision = viewerRole === "backup_provider" && !handoff.backupAcceptedAt && handoff.status !== "active";
                const sourceCanCancel = viewerRole === "from_provider" && handoff.status !== "active";
                return (
                  <div key={handoff.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{viewerRole === "backup_provider" ? "Coverage request" : "Trusted backup"}</p>
                        <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{coverageReasonLabel(handoff.reason)}</p>
                      </div>
                      <span className="text-xs" style={{ color: CSP_PRIMARY_BUTTON }}>{handoffStatusLabel(summary)}</span>
                    </div>
                    <p className="mt-3 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{handoffStatusCopy(summary)}</p>
                    {handoff.reasonNote ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{handoff.reasonNote}</p> : null}
                    {backupNeedsDecision ? (
                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <button type="button" disabled={busyHandoffId === handoff.id} onClick={() => void respondToHandoff(handoff.id, "accept")} className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>I can cover</button>
                        <button type="button" disabled={busyHandoffId === handoff.id} onClick={() => void respondToHandoff(handoff.id, "decline")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold">I can&apos;t</button>
                      </div>
                    ) : sourceCanCancel ? (
                      <button type="button" disabled={busyHandoffId === handoff.id} onClick={() => void respondToHandoff(handoff.id, "cancel")} className="mt-4 text-xs font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Cancel request</button>
                    ) : null}
                    <details className="mt-3 border-t border-white/10 pt-3">
                      <summary className="cursor-pointer list-none text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>How this works</summary>
                      <p className="mt-2 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>{handoffBoundaryCopy(summary)}</p>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {view === "connections" ? (
        <section>
          {pending.length > 0 ? (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>For you</h2>
              <div className="space-y-3">
                {pending.map((summary) => {
                  const { relationship, direction } = summary;
                  const role = myNetworkRole(summary);
                  const consent = myNetworkConsent(summary);
                  return (
                    <div key={relationship.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                      <div className="flex items-start gap-3">
                        <Users size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-medium">{relationshipLabel(relationship.type)}</p>
                            <span className="text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>{provenanceLabel(relationship)}</span>
                          </div>
                          <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                            {role ? `Your role: ${role}` : consent.accepted ? "Waiting on the other person" : direction === "inbound" ? "Offered to you" : "Ready for your decision"}
                          </p>
                          {relationship.purpose ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{relationship.purpose}</p> : null}
                        </div>
                      </div>
                      {!isOfflinePreviewMode ? consent.accepted ? (
                        <button type="button" disabled={busyId === relationship.id} onClick={() => void respond(relationship.id, "decline")} className="mt-4 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Withdraw</button>
                      ) : (
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button type="button" disabled={busyId === relationship.id} onClick={() => void respond(relationship.id, "accept")} className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Connect</button>
                          <button type="button" disabled={busyId === relationship.id} onClick={() => void respond(relationship.id, "decline")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold">Pass</button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Connected</h2>
          {active.length === 0 ? (
            <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
              <div className="flex items-start gap-3">
                <Network size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
                <div>
                  <p className="text-sm font-medium">No active connections yet.</p>
                  <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Useful introductions appear here after both people agree.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {active.map((summary) => {
                const { relationship } = summary;
                const role = myNetworkRole(summary);
                return (
                  <div key={relationship.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{relationshipLabel(relationship.type)}</p>
                        {role ? <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Your role: {role}</p> : null}
                      </div>
                      <span className="text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>{provenanceLabel(relationship)}</span>
                    </div>
                    {relationship.purpose ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{relationship.purpose}</p> : null}
                    {!isOfflinePreviewMode ? <button type="button" disabled={busyId === relationship.id} onClick={() => void respond(relationship.id, "end")} className="mt-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>End connection</button> : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
