import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Handshake, Home, Network, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { NetworkConnectionSummary, NetworkRelationship } from "@/domain/network";
import type { ProviderHouseholdRelationshipSummary } from "@/domain/serviceRelationship";
import type { TrustedServiceHandoffSummary } from "@/domain/trustedHandoff";
import { isOfflinePreviewMode } from "@/lib/supabase";
import { listMyNetworkRelationships, respondToNetworkRelationship } from "@/lib/networkApi";
import { listMyHouseholdContinuity } from "@/lib/serviceRelationshipApi";
import { listMyTrustedServiceHandoffs } from "@/lib/trustedHandoffApi";
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
    case "mentor": return "Mentorship";
    case "coverage_partner": return "Coverage partner";
    case "business_collaborator": return "Business collaborator";
    default: return "Peer connection";
  }
}

export default function NetworkScreen() {
  const navigate = useNavigate();
  const [connections, setConnections] = useState<NetworkConnectionSummary[]>([]);
  const [handoffs, setHandoffs] = useState<TrustedServiceHandoffSummary[]>([]);
  const [households, setHouseholds] = useState<ProviderHouseholdRelationshipSummary[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
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
          Cleanr can connect you with households, mentors, peers, trusted coverage, and collaborators. This is not a follower graph or social feed—each relationship exists for a clear purpose.
        </p>
      </header>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="rounded-2xl border" style={{ backgroundColor: "rgba(141,204,100,.08)", borderColor: "rgba(141,204,100,.22)", padding: CSP_CARD_PADDING }}>
          <div className="flex items-start gap-3">
            <ShieldCheck size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
            <div>
              <p className="text-sm font-medium">Relationships are earned, mutual, and portable.</p>
              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                Cleanr supports continuity and trust without pretending to own the relationship. New peer connections become active only with consent, and household continuity comes from real service together.
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
                A booking is a transaction. Repeated service creates familiarity. Cleanr is beginning to preserve that continuity so each visit can build on the last instead of starting over.
              </p>
              {!isOfflinePreviewMode ? (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                  <span>{repeatHouseholds.length} repeat household{repeatHouseholds.length === 1 ? "" : "s"}</span>
                  <span>{scheduledHouseholds.length} with a next visit</span>
                </div>
              ) : (
                <p className="mt-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Once live data is available, this will show real household continuity from booking history.</p>
              )}
            </div>
          </div>
        </div>
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
                A coverage partner can become a trusted backup for a specific cleaning. Cleanr records who introduced the backup and both the CSP and household must agree before the handoff becomes active.
              </p>
              {!isOfflinePreviewMode ? (
                <p className="mt-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                  {liveHandoffs.length > 0 ? `${liveHandoffs.length} handoff${liveHandoffs.length === 1 ? "" : "s"} currently in progress.` : "No active handoffs right now."}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Connections to consider</h2>
        {pending.length === 0 ? (
          <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
            <div className="flex items-start gap-3">
              <Sparkles size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
              <div>
                <p className="text-sm font-medium">No suggested connections yet.</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  As the network grows, Kinex can help surface people whose experience or goals may complement yours. Cleanr will store the durable relationship only after consent.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(({ relationship, direction }) => (
              <div key={relationship.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                <div className="flex items-start gap-3">
                  <Users size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{relationshipLabel(relationship.type)}</p>
                    <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{direction === "inbound" ? "Connection offered to you" : "Waiting on the other person"}</p>
                    {relationship.purpose ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{relationship.purpose}</p> : null}
                  </div>
                </div>
                {direction === "inbound" && !isOfflinePreviewMode ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" disabled={busyId === relationship.id} onClick={() => void respond(relationship.id, "accept")} className="rounded-xl px-3 py-2 text-xs font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Accept</button>
                    <button type="button" disabled={busyId === relationship.id} onClick={() => void respond(relationship.id, "decline")} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold">Pass</button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Active peer relationships</h2>
        {active.length === 0 ? (
          <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
            <div className="flex items-start gap-3">
              <Handshake size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
              <div>
                <p className="text-sm font-medium">Your trusted peer network will appear here.</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>The goal is useful relationships, not a high connection count.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map(({ relationship }) => (
              <div key={relationship.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                <p className="text-sm font-medium">{relationshipLabel(relationship.type)}</p>
                {relationship.purpose ? <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{relationship.purpose}</p> : null}
                {!isOfflinePreviewMode ? <button type="button" disabled={busyId === relationship.id} onClick={() => void respond(relationship.id, "end")} className="mt-3 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>End relationship</button> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
