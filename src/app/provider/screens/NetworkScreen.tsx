import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Handshake, Home, Network, ShieldCheck, Sparkles, Users } from "lucide-react";
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
    case "opportunity_match": return "Introduced through a matched opportunity";
    case "booking": return "Introduced through service history";
    case "referral": return "Introduced through a referral";
    case "admin": return "Introduced by Cleanr";
    default: return relationship.origin === "kinex" ? "Suggested by Cleanr" : "Introduced by Cleanr";
  }
}

function formatContinuityDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function continuitySourceLabel(summary: ProviderHouseholdRelationshipSummary): string {
  return summary.source === "durable_relationship" ? "Relationship preserved" : "Booking history";
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
  if (handoff.status === "active" && handoff.fulfillmentAppliedAt) return "backup assigned";
  return handoff.status.replaceAll("_", " ");
}

function handoffStatusCopy(summary: TrustedServiceHandoffSummary): string {
  const { handoff, viewerRole } = summary;
  if (handoff.status === "active" && handoff.fulfillmentAppliedAt) {
    return "The backup CSP and household both agreed, and Cleanr formally reconciled the booking to the trusted backup. The residential service engine now owns fulfillment.";
  }
  if (handoff.status === "active") {
    return "The backup CSP and household both agreed. The trust transfer is active, but formal booking assignment is still waiting on Cleanr operations reconciliation.";
  }
  if (viewerRole === "backup_provider") {
    if (handoff.backupAcceptedAt && !handoff.customerConfirmedAt) return "You agreed to cover this visit. Waiting for household approval.";
    if (handoff.customerConfirmedAt && !handoff.backupAcceptedAt) return "The household approved this backup. Your decision is still required.";
    return "A coverage partner asked you to be the trusted backup for one visit. Nothing changes unless you and the household both agree.";
  }
  if (handoff.backupAcceptedAt && !handoff.customerConfirmedAt) return "Your backup agreed. Waiting for household approval.";
  if (handoff.customerConfirmedAt && !handoff.backupAcceptedAt) return "The household approved your backup. Waiting for the backup CSP to accept.";
  return "You proposed a trusted backup. The handoff stays inactive until the backup CSP and household both agree.";
}

function handoffBoundaryCopy(summary: TrustedServiceHandoffSummary): string {
  const { handoff } = summary;
  if (handoff.fulfillmentAppliedAt) {
    return "The booking is formally assigned to the trusted backup. From here, normal Jobs/service-engine rules own fulfillment and customer confirmation; the handoff itself cannot declare service complete.";
  }
  if (handoff.status === "active") {
    return "Mutual consent does not itself reassign the booking. Only Cleanr operations can reconcile the trusted backup into the residential service engine.";
  }
  return "A coverage request records proposed consent and trust only. It does not reassign the booking or let either CSP declare fulfillment complete.";
}

export default function NetworkScreen() {
  const navigate = useNavigate();
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
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <Network size={14} style={{ color: CSP_PRIMARY_BUTTON }} />
          <span style={{ color: CSP_TEXT_SECONDARY }}>People who can help each other</span>
        </div>
        <h1 className="text-2xl font-semibold">Your Network</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          Cleanr can preserve the relationships already created through service and, when you want it, make useful introductions to peers, coverage partners, collaborators, or people with relevant experience. This is not a follower graph or social feed.
        </p>
      </header>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="rounded-2xl border" style={{ backgroundColor: "rgba(141,204,100,.08)", borderColor: "rgba(141,204,100,.22)", padding: CSP_CARD_PADDING }}>
          <div className="flex items-start gap-3">
            <ShieldCheck size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
            <div>
              <p className="text-sm font-medium">Relationships are earned, mutual, and portable.</p>
              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                Cleanr supports continuity and trust without pretending to own the relationship. New person-to-person connections become active only with consent, and household continuity comes from real service together.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Households you know</h2>
        <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
          <div className="flex items-start gap-3">
            <Home size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Residential relationship continuity</p>
                <span className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{isOfflinePreviewMode ? "Preview" : `${households.length} household${households.length === 1 ? "" : "s"}`}</span>
              </div>
              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                A booking is a transaction. Service together creates familiarity. Cleanr preserves the relationship separately so each visit can build on the last without turning household memory into a profile here.
              </p>
              {!isOfflinePreviewMode ? (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                  <span>{repeatHouseholds.length} repeat household{repeatHouseholds.length === 1 ? "" : "s"}</span>
                  <span>{scheduledHouseholds.length} with a next visit</span>
                </div>
              ) : (
                <p className="mt-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Live continuity will use durable relationship truth first, with booking history only as fallback.</p>
              )}
            </div>
          </div>
        </div>

        {!isOfflinePreviewMode && households.length > 0 ? (
          <div className="mt-3 space-y-3">
            {households.map((household, index) => {
              const lastServed = formatContinuityDate(household.lastServedAt);
              const nextVisit = formatContinuityDate(household.nextScheduledAt);
              return (
                <div key={`${household.customerId}-${index}`} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{household.householdLabel}</p>
                      <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                        {household.completedServicesCount} completed service{household.completedServicesCount === 1 ? "" : "s"} together
                      </p>
                    </div>
                    <span className="text-[11px]" style={{ color: household.source === "durable_relationship" ? CSP_PRIMARY_BUTTON : CSP_TEXT_SECONDARY }}>
                      {continuitySourceLabel(household)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                    {lastServed ? <span>Last service: {lastServed}</span> : <span>No completed visit recorded yet</span>}
                    {nextVisit ? <span>Next visit: {nextVisit}</span> : null}
                  </div>
                  <p className="mt-3 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
                    This card shows relationship continuity only. Household preferences and memory stay purpose-limited to the service contexts that need them.
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Trusted coverage</h2>
        <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
          <div className="flex items-start gap-3">
            <Handshake size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">Continuity when you cannot make a visit</p>
                <span className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{isOfflinePreviewMode ? "Preview" : `${coveragePartners.length} partner${coveragePartners.length === 1 ? "" : "s"}`}</span>
              </div>
              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                A coverage partner can become a trusted backup for a specific cleaning. Cleanr records who introduced the backup and both the backup CSP and household must agree before the handoff becomes active.
              </p>
              {!isOfflinePreviewMode ? (
                <p className="mt-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                  {liveHandoffs.length > 0 ? `${liveHandoffs.length} handoff${liveHandoffs.length === 1 ? "" : "s"} currently in progress.` : "No active handoffs right now."}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {!isOfflinePreviewMode && liveHandoffs.length > 0 ? (
          <div className="mt-3 space-y-3">
            {liveHandoffs.map((summary) => {
              const { handoff, viewerRole } = summary;
              const backupNeedsDecision = viewerRole === "backup_provider" && !handoff.backupAcceptedAt && handoff.status !== "active";
              const sourceCanCancel = viewerRole === "from_provider" && handoff.status !== "active";
              return (
                <div key={handoff.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{viewerRole === "backup_provider" ? "Coverage request for you" : "Your trusted backup handoff"}</p>
                      <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{coverageReasonLabel(handoff.reason)}</p>
                    </div>
                    <span className="text-xs capitalize" style={{ color: CSP_PRIMARY_BUTTON }}>{handoffStatusLabel(summary)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{handoffStatusCopy(summary)}</p>
                  {handoff.reasonNote ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{handoff.reasonNote}</p> : null}
                  {backupNeedsDecision ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" disabled={busyHandoffId === handoff.id} onClick={() => void respondToHandoff(handoff.id, "accept")} className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>I can cover</button>
                      <button type="button" disabled={busyHandoffId === handoff.id} onClick={() => void respondToHandoff(handoff.id, "decline")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold">I can&apos;t cover</button>
                    </div>
                  ) : sourceCanCancel ? (
                    <button type="button" disabled={busyHandoffId === handoff.id} onClick={() => void respondToHandoff(handoff.id, "cancel")} className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold">Cancel handoff</button>
                  ) : null}
                  <p className="mt-3 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
                    {handoffBoundaryCopy(summary)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Connections to consider</h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
            <div className="flex items-start gap-3">
              <Sparkles size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
              <div>
                <p className="text-sm font-medium">No suggested connections right now.</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  If you opt into introductions, Cleanr can surface someone when a real reason exists for the connection. Cleanr records the introduction and activates the relationship only after both people consent.
                </p>
              </div>
            </div>
          </div>
        ) : (
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
                      <p className="text-sm font-medium">{relationshipLabel(relationship.type)}</p>
                      <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                        {role ? `Your role: ${role}` : consent.accepted ? "You accepted · waiting on the other person" : direction === "inbound" ? "Connection offered to you" : "Introduction ready for your decision"}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{provenanceLabel(relationship)}</p>
                      {relationship.purpose ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{relationship.purpose}</p> : null}
                    </div>
                  </div>
                  {!isOfflinePreviewMode ? consent.accepted ? (
                    <div className="mt-4">
                      <button type="button" disabled={busyId === relationship.id} onClick={() => void respond(relationship.id, "decline")} className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold">Withdraw</button>
                    </div>
                  ) : (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button type="button" disabled={busyId === relationship.id} onClick={() => void respond(relationship.id, "accept")} className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Accept</button>
                      <button type="button" disabled={busyId === relationship.id} onClick={() => void respond(relationship.id, "decline")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold">Pass</button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Active relationships</h2>
        {active.length === 0 ? (
          <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
            <div className="flex items-start gap-3">
              <Handshake size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
              <div>
                <p className="text-sm font-medium">Useful network relationships will appear here.</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>The goal is not a high connection count. It is having the right relationships when they create real possibility.</p>
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
                  <p className="text-sm font-medium">{relationshipLabel(relationship.type)}</p>
                  {role ? <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Your role: {role}</p> : null}
                  <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{provenanceLabel(relationship)}</p>
                  {relationship.purpose ? <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{relationship.purpose}</p> : null}
                  {!isOfflinePreviewMode ? <button type="button" disabled={busyId === relationship.id} onClick={() => void respond(relationship.id, "end")} className="mt-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>End relationship</button> : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}