import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Handshake, Network, Share2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Contribution, ContributionCirculation } from "@/domain/growth";
import { CSP_GROWTH_ROUTES } from "@/app/provider/growthRoutes";
import { listMyContributionCirculation, listMyContributions } from "@/lib/growthApi";
import { supabase } from "@/lib/supabase";
import {
  CSP_PRIMARY_BUTTON,
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
  if (contribution.sourceType === "existing_client_relationship_connected") return "Existing relationship preserved";
  if (contribution.sourceType === "provider_affiliate_qualified") return "New household brought in";
  if (contribution.type === "trust_handoff") return "Trusted handoff completed";
  if (contribution.type === "backup_coverage") return "Backup coverage provided";
  return contribution.type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function descriptionForContribution(contribution: Contribution): string {
  if (contribution.sourceType === "existing_client_relationship_connected") return "A relationship you built before Cleanr stayed connected to you.";
  if (contribution.sourceType === "provider_affiliate_qualified") return "A new household completed a qualifying paid cleaning through your referral.";
  if (contribution.type === "trust_handoff") return "You helped transfer trust so service could continue.";
  if (contribution.type === "backup_coverage") return "You helped another household stay covered.";
  return "Your action created value beyond a single booking.";
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
        if (!summaryResult.error && summaryResult.data) setSummary({ ...EMPTY_SUMMARY, ...(summaryResult.data as Partial<CollectiveSummary>) });
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load impact");
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

  const impactRows = [
    { label: "Relationships kept", value: summary.existing_client_relationships, icon: Handshake },
    { label: "New households", value: summary.new_households_qualified, icon: Share2 },
    { label: "Trusted handoffs", value: summary.trust_handoffs, icon: Users },
    { label: "Value reused", value: summary.contributions_circulated, icon: Network },
  ].filter((row) => loading || row.value > 0);

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate(CSP_GROWTH_ROUTES.home)} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
        <ArrowLeft size={16} /> North Star
      </button>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Impact</h1>
        <p className="mt-1 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>What your work has helped create for people and the network.</p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}

      <section className="mb-7 border-y border-white/10 py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold">{loading ? "—" : summary.total_contributions}</p>
            <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>verified impact record{summary.total_contributions === 1 ? "" : "s"}</p>
          </div>
          {summary.last_contribution_at ? (
            <p className="text-right text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>Latest {new Date(summary.last_contribution_at).toLocaleDateString()}</p>
          ) : null}
        </div>
      </section>

      {impactRows.length > 0 ? (
        <section className="mb-7">
          <h2 className="mb-2 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>At a glance</h2>
          <div className="border-y border-white/10">
            {impactRows.map(({ label, value, icon: Icon }, index) => (
              <div key={label} className={`flex items-center gap-3 py-3 ${index > 0 ? "border-t border-white/10" : ""}`}>
                <Icon size={17} className="shrink-0" style={{ color: CSP_PRIMARY_BUTTON }} />
                <p className="flex-1 text-sm">{label}</p>
                <p className="text-sm font-semibold">{loading ? "—" : value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>History</h2>
        {loading ? (
          <p className="border-y border-white/10 py-5 text-sm" style={{ color: CSP_TEXT_SECONDARY }}>Loading…</p>
        ) : contributions.length === 0 ? (
          <div className="border-y border-white/10 py-5">
            <p className="text-sm font-medium">Nothing here yet.</p>
            <p className="mt-1 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Verified impact will appear as your work creates value beyond a single visit.</p>
          </div>
        ) : (
          <div className="border-y border-white/10">
            {contributions.map((contribution, index) => {
              const recirculated = circulationByContribution.get(contribution.id) ?? [];
              return (
                <div key={contribution.id} className={`py-4 ${index > 0 ? "border-t border-white/10" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{labelForContribution(contribution)}</p>
                      <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{descriptionForContribution(contribution)}</p>
                    </div>
                    <span className="shrink-0 text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>{new Date(contribution.occurredAt).toLocaleDateString()}</span>
                  </div>

                  {recirculated.length > 0 ? (
                    <details className="mt-3">
                      <summary className="cursor-pointer list-none text-xs font-medium" style={{ color: CSP_PRIMARY_BUTTON }}>
                        See where this value helped
                      </summary>
                      <div className="mt-2 space-y-2">
                        {recirculated.map((item) => (
                          <div key={`${item.contributionId}:${item.opportunityId}`} className="border-t border-white/10 pt-2">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-medium">{item.opportunityTitle}</p>
                              <span className="text-[10px]" style={{ color: CSP_TEXT_SECONDARY }}>{labelForOpportunityType(item.opportunityType)}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{item.capacityReason}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
