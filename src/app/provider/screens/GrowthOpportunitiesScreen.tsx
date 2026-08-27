import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Compass, MapPin, SlidersHorizontal, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { GrowthOpportunity, OpportunityMatch } from "@/domain/growth";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
import { isOfflinePreviewMode } from "@/lib/supabase";
import {
  listMyOpportunityMatches,
  listOpenGrowthOpportunities,
  respondToMyOpportunityMatch,
} from "@/lib/growthApi";
import {
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SURFACE,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

function opportunityTypeLabel(type: GrowthOpportunity["type"]): string {
  return type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function matchStatusLabel(status: OpportunityMatch["status"]): string {
  if (status === "offered") return "Offer ready";
  if (status === "interested") return "Interest shared";
  return status.replaceAll("_", " ");
}

export default function GrowthOpportunitiesScreen() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<OpportunityMatch[]>([]);
  const [open, setOpen] = useState<GrowthOpportunity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyMatchId, setBusyMatchId] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      const [myMatches, openOpportunities] = await Promise.all([
        listMyOpportunityMatches(),
        listOpenGrowthOpportunities(),
      ]);
      setMatches(myMatches);
      setOpen(openOpportunities);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load opportunities");
    }
  }

  useEffect(() => { void refresh(); }, []);

  const matchedOpportunityIds = useMemo(() => new Set(matches.map((match) => match.opportunityId)), [matches]);
  const discoverable = open.filter((opportunity) => !matchedOpportunityIds.has(opportunity.id));

  async function respond(matchId: string, status: "interested" | "accepted" | "declined") {
    if (isOfflinePreviewMode || busyMatchId) return;
    try {
      setBusyMatchId(matchId);
      setError(null);
      await respondToMyOpportunityMatch(matchId, status);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update opportunity response");
    } finally {
      setBusyMatchId(null);
    }
  }

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.home)} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <ArrowLeft size={16} /> Growth
      </button>

      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <Sparkles size={14} style={{ color: CSP_PRIMARY_BUTTON }} />
          <span style={{ color: CSP_TEXT_SECONDARY }}>Paths beyond Jobs</span>
        </div>
        <h1 className="text-2xl font-semibold">Opportunities</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          Jobs remain in Jobs. This space is for useful paths beyond a cleaning assignment—coverage, referrals, training, leadership, business, vendor, education, external, investing, or something the network makes possible later.
        </p>
        <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.fit)} className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold">
          <SlidersHorizontal size={14} /> Set what fits my life
        </button>
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Matched for you</h2>
        {matches.length === 0 ? (
          <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
            <p className="text-sm font-medium">No matched opportunities yet.</p>
            <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
              When you opt into opportunity matching, Kinex may use durable Cleanr truth such as your North Star, capabilities, interests, location, and practical constraints to decide what may be relevant. Cleanr stores the resulting match. Turning matching off stops new matching and never affects cleaning marketplace access, ranking, payouts, or service opportunities.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div key={match.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs" style={{ color: CSP_PRIMARY_BUTTON }}>{opportunityTypeLabel(match.opportunity.type)}</span>
                  <span className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{matchStatusLabel(match.status)}</span>
                </div>
                <h3 className="mt-2 font-semibold">{match.opportunity.title}</h3>
                {match.northStarAlignment ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}><strong style={{ color: CSP_TEXT_PRIMARY }}>North Star:</strong> {match.northStarAlignment}</p> : null}
                {match.capabilityAlignment ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}><strong style={{ color: CSP_TEXT_PRIMARY }}>Capabilities:</strong> {match.capabilityAlignment}</p> : null}
                {match.interestAlignment ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}><strong style={{ color: CSP_TEXT_PRIMARY }}>Interests:</strong> {match.interestAlignment}</p> : null}
                {match.constraintFit ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}><strong style={{ color: CSP_TEXT_PRIMARY }}>Fit:</strong> {match.constraintFit}</p> : null}
                {match.matchReason ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Why this surfaced: {match.matchReason}</p> : null}

                {match.status === "offered" && !isOfflinePreviewMode ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" disabled={busyMatchId === match.id} onClick={() => void respond(match.id, "accepted")} className="rounded-xl px-2 py-2 text-xs font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Accept offer</button>
                    <button type="button" disabled={busyMatchId === match.id} onClick={() => void respond(match.id, "declined")} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-semibold">Pass</button>
                  </div>
                ) : !["interested","accepted","declined","completed"].includes(match.status) && !isOfflinePreviewMode ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" disabled={busyMatchId === match.id} onClick={() => void respond(match.id, "interested")} className="rounded-xl px-2 py-2 text-xs font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>I&apos;m interested</button>
                    <button type="button" disabled={busyMatchId === match.id} onClick={() => void respond(match.id, "declined")} className="rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-xs font-semibold">Pass</button>
                  </div>
                ) : null}

                {match.status === "interested" ? (
                  <p className="mt-3 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                    Interest shared. Kinex or Cleanr operations can decide whether to offer the opportunity; you are not committed yet.
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Open in the network</h2>
        {discoverable.length === 0 ? (
          <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>No additional open opportunities right now.</p>
        ) : (
          <div className="space-y-3">
            {discoverable.map((opportunity) => (
              <div key={opportunity.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                <div className="flex items-center gap-2 text-xs" style={{ color: CSP_PRIMARY_BUTTON }}><Compass size={14} /> {opportunityTypeLabel(opportunity.type)}</div>
                <h3 className="mt-2 font-semibold">{opportunity.title}</h3>
                {opportunity.description ? <p className="mt-2 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{opportunity.description}</p> : null}
                {opportunity.geographicScope ? <div className="mt-3 flex items-center gap-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}><MapPin size={13} /> {opportunity.geographicScope}</div> : null}
                <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: CSP_TEXT_SECONDARY }}><span>Discovery only for now</span><ArrowRight size={13} /></div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
