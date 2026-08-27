import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Network, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Contribution, ContributionCirculation } from "@/domain/growth";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
import { listMyContributionCirculation, listMyContributions } from "@/lib/growthApi";
import {
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SURFACE,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

function labelForContribution(type: Contribution["type"]): string {
  return type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labelForOpportunityType(type: ContributionCirculation["opportunityType"]): string {
  return type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ContributionsScreen() {
  const navigate = useNavigate();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [circulation, setCirculation] = useState<ContributionCirculation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([listMyContributions(), listMyContributionCirculation()])
      .then(([contributionRows, circulationRows]) => {
        if (!active) return;
        setContributions(contributionRows);
        setCirculation(circulationRows);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load contributions");
      });
    return () => { active = false; };
  }, []);

  const circulationByContribution = useMemo(() => {
    const grouped = new Map<string, ContributionCirculation[]>();
    for (const item of circulation) {
      const current = grouped.get(item.contributionId) ?? [];
      current.push(item);
      grouped.set(item.contributionId, current);
    }
    return grouped;
  }, [circulation]);

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.home)} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <ArrowLeft size={16} /> Growth
      </button>

      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <Sparkles size={14} style={{ color: CSP_PRIMARY_BUTTON }} />
          <span style={{ color: CSP_TEXT_SECONDARY }}>Value that remains</span>
        </div>
        <h1 className="text-2xl font-semibold">Contribution</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          This is durable evidence of value you helped create for another person or for the network. When that value later helps make a new opportunity possible, Cleanr can show the circulation without exposing who was matched or who received it.
        </p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <section>
        {contributions.length === 0 ? (
          <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
            <div className="flex items-start gap-3">
              <Network size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
              <div>
                <p className="text-sm font-medium">No contribution history yet.</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  Contributions are not self-awarded points. They appear when Cleanr has durable provenance that your action created value for another person or strengthened the collective.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {contributions.map((contribution) => {
              const recirculated = circulationByContribution.get(contribution.id) ?? [];
              return (
                <div key={contribution.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{labelForContribution(contribution.type)}</p>
                    <span className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{new Date(contribution.occurredAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-2 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                    Recorded by {contribution.sourceSystem}{contribution.sourceType ? ` · ${contribution.sourceType}` : ""}
                  </p>

                  {recirculated.length > 0 ? (
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <div className="flex items-center gap-2">
                        <Network size={15} style={{ color: CSP_PRIMARY_BUTTON }} />
                        <p className="text-xs font-medium">This value circulated.</p>
                      </div>
                      <div className="mt-2 space-y-2">
                        {recirculated.map((item) => (
                          <div key={`${item.contributionId}:${item.opportunityId}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-medium">{item.opportunityTitle}</p>
                              <span className="text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}>{labelForOpportunityType(item.opportunityType)}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{item.capacityReason}</p>
                            <p className="mt-2 text-[10px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
                              This shows that your verified contribution helped create another opportunity. It does not reveal who was matched, accepted, or benefited.
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-[10px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
                      If this value later helps make a new opportunity possible, that circulation can appear here. No score or reward multiplier is attached to it.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
