import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Handshake, Network, Share2, Sparkles, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Contribution, ContributionCirculation } from "@/domain/growth";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
import { listMyContributionCirculation, listMyContributions } from "@/lib/growthApi";
import { supabase } from "@/lib/supabase";
import {
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SURFACE,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

type CollectiveSummary = {
  total_contributions: number;
  existing_client_relationships: number;
  new_households_qualified: number;
  trust_handoffs: number;
  backup_coverage: number;
  mentorship: number;
  knowledge: number;
  opportunities_created: number;
  businesses_created: number;
  employment_created: number;
  leadership: number;
  contributions_circulated: number;
  last_contribution_at: string | null;
};

const EMPTY_SUMMARY: CollectiveSummary = {
  total_contributions: 0,
  existing_client_relationships: 0,
  new_households_qualified: 0,
  trust_handoffs: 0,
  backup_coverage: 0,
  mentorship: 0,
  knowledge: 0,
  opportunities_created: 0,
  businesses_created: 0,
  employment_created: 0,
  leadership: 0,
  contributions_circulated: 0,
  last_contribution_at: null,
};

function labelForContribution(contribution: Contribution): string {
  if (contribution.sourceType === "existing_client_relationship_connected") return "Existing client relationship preserved";
  if (contribution.sourceType === "provider_affiliate_qualified") return "New household brought into Cleanr";
  if (contribution.type === "trust_handoff") return "Trusted handoff completed";
  if (contribution.type === "backup_coverage") return "Backup coverage provided";
  return contribution.type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function descriptionForContribution(contribution: Contribution): string {
  if (contribution.sourceType === "existing_client_relationship_connected") {
    return "A relationship you created before Cleanr was connected without erasing its origin.";
  }
  if (contribution.sourceType === "provider_affiliate_qualified") {
    return "A genuinely new household reached a qualifying paid cleaning through your referral.";
  }
  if (contribution.type === "trust_handoff") {
    return "You transferred trust to another provider so service continuity could be preserved.";
  }
  if (contribution.type === "backup_coverage") {
    return "You helped another relationship remain covered when the primary provider could not serve it.";
  }
  return "Cleanr has durable provenance that this action created value for another person or strengthened the network.";
}

function labelForOpportunityType(type: ContributionCirculation["opportunityType"]): string {
  return type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ContributionsScreen() {
  const navigate = useNavigate();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [circulation, setCirculation] = useState<ContributionCirculation[]>([]);
  const [summary, setSummary] = useState<CollectiveSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      listMyContributions(),
      listMyContributionCirculation(),
      supabase.rpc("get_my_collective_contribution_summary"),
    ])
      .then(([contributionRows, circulationRows, summaryResult]) => {
        if (!active) return;
        setContributions(contributionRows);
        setCirculation(circulationRows);
        if (!summaryResult.error && summaryResult.data) {
          setSummary({ ...EMPTY_SUMMARY, ...(summaryResult.data as Partial<CollectiveSummary>) });
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load contributions");
      })
      .finally(() => {
        if (active) setLoading(false);
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

  const collectiveRows = [
    { label: "Existing relationships preserved", value: summary.existing_client_relationships, icon: Handshake },
    { label: "New households qualified", value: summary.new_households_qualified, icon: Share2 },
    { label: "Trust handoffs", value: summary.trust_handoffs, icon: Users },
    { label: "Value circulated forward", value: summary.contributions_circulated, icon: Network },
  ];

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.home)} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <ArrowLeft size={16} /> Growth
      </button>

      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <Sparkles size={14} style={{ color: CSP_PRIMARY_BUTTON }} />
          <span style={{ color: CSP_TEXT_SECONDARY }}>Value that remains after the transaction</span>
        </div>
        <h1 className="text-2xl font-semibold">Collective contribution</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          Cleaning can create more than a completed booking. Cleanr keeps durable evidence when your relationships, referrals, coverage, knowledge, or leadership increase what the network can do next.
        </p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="rounded-2xl border p-4" style={{ backgroundColor: "rgba(141,204,100,.06)", borderColor: "rgba(141,204,100,.22)" }}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: CSP_PRIMARY_BUTTON }}>Your durable contribution record</p>
              <p className="mt-2 text-3xl font-semibold">{loading ? "—" : summary.total_contributions}</p>
              <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>verified contribution{summary.total_contributions === 1 ? "" : "s"} recorded</p>
            </div>
            {summary.last_contribution_at ? (
              <p className="text-right text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
                Latest<br />{new Date(summary.last_contribution_at).toLocaleDateString()}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>What you have added to the network</h2>
        <div className="grid grid-cols-2 gap-3">
          {collectiveRows.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl border p-4" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)" }}>
              <Icon size={18} style={{ color: CSP_PRIMARY_BUTTON }} />
              <p className="mt-3 text-2xl font-semibold">{loading ? "—" : value}</p>
              <p className="mt-1 text-xs leading-4" style={{ color: CSP_TEXT_SECONDARY }}>{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-medium">Contribution history</h2>
          <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Provenance, not points. These records are created from verified Cleanr activity.</p>
        </div>

        {loading ? (
          <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
            <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading contribution history…</p>
          </div>
        ) : contributions.length === 0 ? (
          <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}>
            <div className="flex items-start gap-3">
              <Network size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
              <div>
                <p className="text-sm font-medium">No contribution history yet.</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  Contributions are not self-awarded. They appear when Cleanr has durable provenance that your action created value for another person or strengthened the collective.
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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{labelForContribution(contribution)}</p>
                      <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{descriptionForContribution(contribution)}</p>
                    </div>
                    <span className="shrink-0 text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>{new Date(contribution.occurredAt).toLocaleDateString()}</span>
                  </div>

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
                              Your verified contribution helped make another opportunity possible. Cleanr does not expose who was matched or who benefited.
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 border-t border-white/10 pt-3 text-[10px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>
                      If this value later helps create another opportunity, that circulation can appear here. No score or reward multiplier is attached to it.
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
