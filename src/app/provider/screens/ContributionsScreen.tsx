import { useEffect, useState } from "react";
import { ArrowLeft, Network, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Contribution } from "@/domain/growth";
import { listMyContributions } from "@/lib/growthApi";
import { CSP_CARD_PADDING, CSP_PRIMARY_BUTTON, CSP_SURFACE, CSP_SECTION_GAP, CSP_TEXT_PRIMARY, CSP_TEXT_SECONDARY } from "@/theme/cspTheme";

function labelForContribution(type: Contribution["type"]): string {
  return type.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function ContributionsScreen() {
  const navigate = useNavigate();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listMyContributions()
      .then((rows) => { if (active) setContributions(rows); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Unable to load contributions"); });
    return () => { active = false; };
  }, []);

  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <button type="button" onClick={() => navigate("/csp/dashboard/growth")} className="mb-5 flex items-center gap-2 text-sm" style={{ color: CSP_TEXT_SECONDARY }}><ArrowLeft size={16} /> Growth</button>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"><Sparkles size={14} style={{ color: CSP_PRIMARY_BUTTON }} /><span style={{ color: CSP_TEXT_SECONDARY }}>Value that remains</span></div>
        <h1 className="text-2xl font-semibold">Contribution</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>This is evidence of value you helped create for someone else or for the network: referrals, coverage, mentorship, trust handoffs, knowledge, opportunities, businesses, employment, capital, or leadership.</p>
      </header>
      {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
      <section>
        {contributions.length === 0 ? <div className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}><div className="flex items-start gap-3"><Network size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} /><div><p className="text-sm font-medium">No contribution history yet.</p><p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Contributions are not self-awarded points. They appear when Cleanr has durable provenance that your action created value for another person or strengthened the collective.</p></div></div></div> : <div className="space-y-3">{contributions.map((contribution) => <div key={contribution.id} className="rounded-2xl border" style={{ backgroundColor: CSP_SURFACE, borderColor: "rgba(248,250,252,.08)", padding: CSP_CARD_PADDING }}><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">{labelForContribution(contribution.type)}</p><span className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>{new Date(contribution.occurredAt).toLocaleDateString()}</span></div><p className="mt-2 text-xs" style={{ color: CSP_TEXT_SECONDARY }}>Recorded by {contribution.sourceSystem}{contribution.sourceType ? ` · ${contribution.sourceType}` : ""}</p></div>)}</div>}
      </section>
    </div>
  );
}
