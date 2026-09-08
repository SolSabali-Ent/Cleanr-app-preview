import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { getProviderApprovalReviewEvidence } from "../../lib/cspActivation";
import { useIsAdmin } from "../../lib/useIsAdmin";
import { supabase } from "../../lib/supabase";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPage,
  AdminPageHeader,
  AdminSecondaryButton,
  AdminStatStrip,
  AdminStatus,
  AdminTableShell,
  AdminTabs,
} from "./AdminUi";

type ProviderRow = {
  id: string; full_name: string | null; created_at: string; application_status: string | null; readiness_status: string | null; is_onboarded: boolean | null; marketplace_access: boolean | null; stripe_connect_ready: boolean | null; identity_document_path: string | null; identity_status: string | null; background_check_status: string | null; insurance_status: string | null;
};
type ExistingClientBucket = "none" | "1_2" | "3_5" | "6_plus" | "prefer_not_to_say";
type ReadinessRow = { provider_id: string; submitted_at: string | null; existing_client_household_bucket: ExistingClientBucket | null; recruitment_source: string | null };
type ReferralRow = { id: string; referrer_id: string; referee_id: string | null; relationship_confirmed_at: string | null; created_at: string };
type RelationshipRow = { id: string; provider_id: string; status: string; completed_services_count: number; created_at: string };
type BookingRow = { id: string; service_relationship_id: string | null; provider_id: string | null; status: string; price_cents: number | null; platform_fee_cents: number | null; stripe_payment_intent_id: string | null; payout_released: boolean | null; created_at: string };
type VerificationReviewRow = { id: string; provider_id: string; review_type: string; outcome: string; reviewed_by: string; reviewed_at: string; reviewed_evidence_ref: string | null };
type NorthStarRow = { person_id: string; status: string };
type NetworkRow = { source_person_id: string; target_person_id: string; status: string };
type ContributionRow = { person_id: string; beneficiary_person_id: string | null };
type View = "attention" | "funnel" | "providers";

type PilotGuidance = { stage: string; stageOrder: number; nextAction: string; nextActionTo: string; blockers: string[] };
type ProviderSignal = ProviderRow & {
  readinessSubmitted: boolean; existingClientBucket: ExistingClientBucket | null; recruitmentSource: string | null; verificationReviewCount: number; identityReviewHistory: boolean; backgroundReviewHistory: boolean; identityVerifiedReview: boolean; backgroundClearReview: boolean; latestVerificationReviewAt: string | null; invitesIssued: number; invitesAccepted: number; relationships: number; paidRelationshipBookings: number; relationshipAssignmentsPending: number; completedRelationshipServices: number; grossRelationshipCents: number; platformFeeCents: number; payoutReleasedCount: number; hasNorthStar: boolean; networkRelationships: number; contributions: number; collectiveProof: boolean; foundingActivity: boolean; pilotStage: string; pilotStageOrder: number; blockers: string[]; nextAction: string; nextActionTo: string;
};

const EXISTING_CLIENT_LABELS: Record<ExistingClientBucket, string> = { none: "No existing households", "1_2": "1–2 existing households", "3_5": "3–5 existing households", "6_plus": "6+ existing households", prefer_not_to_say: "Not shared" };
function money(cents: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100); }
function hasExistingHouseholds(bucket: ExistingClientBucket | null) { return bucket === "1_2" || bucket === "3_5" || bucket === "6_plus"; }
function isVerified(value: string | null) { return ["verified", "approved", "clear", "complete", "completed"].includes((value ?? "").trim().toLowerCase()); }

function pilotGuidance(provider: Omit<ProviderSignal, "pilotStage" | "pilotStageOrder" | "blockers" | "nextAction" | "nextActionTo">): PilotGuidance {
  if (!provider.readinessSubmitted) return { stage: "Readiness", stageOrder: 10, nextAction: "Complete readiness", nextActionTo: "/admin/full-app/csp/candidate-readiness", blockers: ["Candidate readiness has not been submitted."] };
  if (!provider.is_onboarded) return { stage: "Onboarding", stageOrder: 20, nextAction: "Complete onboarding", nextActionTo: "/admin/full-app/csp/onboarding", blockers: ["CSP onboarding is not complete."] };
  if (provider.application_status !== "approved") {
    const blockers = [`Application: ${provider.application_status ?? "not submitted"}.`];
    const identityVerified = isVerified(provider.identity_status);
    const backgroundVerified = isVerified(provider.background_check_status);
    if (!identityVerified) blockers.push(`Identity status: ${provider.identity_status ?? "not started"}.`);
    if (!provider.identityVerifiedReview) blockers.push(provider.identityReviewHistory ? "No successful independent identity review matches the current registered evidence." : identityVerified ? "Identity status is verified, but current-evidence independent review is missing." : "No independent identity review recorded yet.");
    if (!backgroundVerified) blockers.push(`Background status: ${provider.background_check_status ?? "not started"}.`);
    if (!provider.backgroundClearReview) blockers.push(provider.backgroundReviewHistory ? "No durable independent background review with outcome clear is recorded." : backgroundVerified ? "Background status is cleared, but independent review history is missing." : "No independent background review recorded yet.");
    return { stage: "Application review", stageOrder: 30, nextAction: !provider.identityVerifiedReview || !provider.backgroundClearReview ? "Record independent review" : "Complete application review", nextActionTo: "/admin/providers", blockers };
  }
  if (!provider.stripe_connect_ready) return { stage: "Payout setup", stageOrder: 40, nextAction: "Finish payout setup", nextActionTo: "/admin/full-app/csp/application", blockers: ["Stripe Connect payout readiness is not complete."] };
  if (provider.invitesIssued === 0 && hasExistingHouseholds(provider.existingClientBucket)) return { stage: "Relationship activation", stageOrder: 50, nextAction: "Invite existing client", nextActionTo: "/admin/full-app/csp/existing-clients", blockers: ["Existing households were reported, but no invitation has been issued."] };
  if (provider.invitesIssued > provider.invitesAccepted) return { stage: "Customer acceptance", stageOrder: 60, nextAction: "Get client acceptance", nextActionTo: "/admin/full-app/csp/existing-clients", blockers: [`${provider.invitesIssued - provider.invitesAccepted} invitation${provider.invitesIssued - provider.invitesAccepted === 1 ? " is" : "s are"} awaiting customer confirmation.`] };
  if (provider.relationships === 0) return { stage: "First relationship", stageOrder: 70, nextAction: hasExistingHouseholds(provider.existingClientBucket) ? "Confirm first relationship" : "Choose first relationship path", nextActionTo: hasExistingHouseholds(provider.existingClientBucket) ? "/admin/full-app/csp/existing-clients" : "/admin/full-app/csp", blockers: [hasExistingHouseholds(provider.existingClientBucket) ? "No durable provider-brought relationship exists yet." : "No durable relationship exists yet."] };
  if (provider.paidRelationshipBookings === 0) return { stage: "First paid relationship", stageOrder: 80, nextAction: "Book first relationship service", nextActionTo: "/admin/full-app/csp", blockers: ["The relationship has not produced a paid Cleanr booking yet."] };
  if (provider.relationshipAssignmentsPending > 0) return { stage: "Kinex reconciliation", stageOrder: 90, nextAction: "Watch Kinex handoff", nextActionTo: "/admin/ops", blockers: [`${provider.relationshipAssignmentsPending} paid relationship booking${provider.relationshipAssignmentsPending === 1 ? " is" : "s are"} awaiting formal Kinex assignment reconciliation.`] };
  if (provider.completedRelationshipServices === 0) return { stage: "First completed service", stageOrder: 100, nextAction: "Complete first relationship visit", nextActionTo: "/admin/full-app/csp/jobs", blockers: ["Paid relationship history exists, but no confirmed completed service yet."] };
  if (!provider.hasNorthStar) return { stage: "North Star", stageOrder: 110, nextAction: "Capture North Star", nextActionTo: "/admin/full-app/csp/growth/milestones", blockers: ["No persistent North Star has been recorded yet."] };
  if (!provider.collectiveProof) return { stage: "Collective proof", stageOrder: 120, nextAction: "Create collective proof", nextActionTo: "/admin/full-app/csp/growth/network", blockers: ["The pilot still needs a real network tie or contribution beyond the individual transaction."] };
  return { stage: "Pilot active", stageOrder: 200, nextAction: "Inspect relationship health", nextActionTo: "/admin/full-app", blockers: [] };
}

export function FoundingCircle() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [view, setView] = useState<View>("attention");
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [readiness, setReadiness] = useState<ReadinessRow[]>([]);
  const [verificationReviews, setVerificationReviews] = useState<VerificationReviewRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [relationships, setRelationships] = useState<RelationshipRow[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [northStars, setNorthStars] = useState<NorthStarRow[]>([]);
  const [network, setNetwork] = useState<NetworkRow[]>([]);
  const [contributions, setContributions] = useState<ContributionRow[]>([]);
  const [pilotRate, setPilotRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [p, ready, reviews, refs, rels, b, ns, net, contrib, rate] = await Promise.all([
        supabase.from("profiles").select("id,full_name,created_at,application_status,readiness_status,is_onboarded,marketplace_access,stripe_connect_ready,identity_document_path,identity_status,background_check_status,insurance_status").eq("role", "csp").order("created_at", { ascending: true }),
        supabase.from("provider_readiness_profiles").select("provider_id,submitted_at,existing_client_household_bucket,recruitment_source"),
        supabase.from("provider_verification_reviews").select("id,provider_id,review_type,outcome,reviewed_by,reviewed_at,reviewed_evidence_ref").order("reviewed_at", { ascending: false }),
        supabase.from("referrals").select("id,referrer_id,referee_id,relationship_confirmed_at,created_at").eq("referral_kind", "existing_client"),
        supabase.from("service_relationships").select("id,provider_id,status,completed_services_count,created_at").eq("origin", "provider_brought"),
        supabase.from("bookings").select("id,service_relationship_id,provider_id,status,price_cents,platform_fee_cents,stripe_payment_intent_id,payout_released,created_at").not("service_relationship_id", "is", null),
        supabase.from("north_stars").select("person_id,status"), supabase.from("network_relationships").select("source_person_id,target_person_id,status"), supabase.from("contributions").select("person_id,beneficiary_person_id"),
        supabase.from("platform_settings").select("value").eq("key", "provider_brought_platform_fee_rate").maybeSingle(),
      ]);
      for (const result of [p, ready, reviews, refs, rels, b, ns, net, contrib, rate]) if (result.error) throw result.error;
      setProviders((p.data ?? []) as ProviderRow[]); setReadiness((ready.data ?? []) as ReadinessRow[]); setVerificationReviews((reviews.data ?? []) as VerificationReviewRow[]); setReferrals((refs.data ?? []) as ReferralRow[]); setRelationships((rels.data ?? []) as RelationshipRow[]); setBookings((b.data ?? []) as BookingRow[]); setNorthStars((ns.data ?? []) as NorthStarRow[]); setNetwork((net.data ?? []) as NetworkRow[]); setContributions((contrib.data ?? []) as ContributionRow[]);
      const parsedRate = Number((rate.data as { value?: string } | null)?.value); setPilotRate(Number.isFinite(parsedRate) ? parsedRate : null);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load Founding Circle launch truth"); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);

  const signals = useMemo<ProviderSignal[]>(() => {
    const readinessByProvider = new Map(readiness.map((row) => [row.provider_id, row]));
    const northStarIds = new Set(northStars.map((row) => row.person_id));
    const relationshipProvider = new Map(relationships.map((row) => [row.id, row.provider_id]));
    return providers.map((provider) => {
      const providerReadiness = readinessByProvider.get(provider.id);
      const providerReviews = verificationReviews.filter((row) => row.provider_id === provider.id);
      const reviewEvidence = getProviderApprovalReviewEvidence(provider, providerReviews);
      const providerInvites = referrals.filter((row) => row.referrer_id === provider.id);
      const providerRelationships = relationships.filter((row) => row.provider_id === provider.id);
      const relationshipIds = new Set(providerRelationships.map((row) => row.id));
      const relationshipBookings = bookings.filter((row) => row.service_relationship_id != null && relationshipIds.has(row.service_relationship_id));
      const paidBookings = relationshipBookings.filter((row) => Boolean(row.stripe_payment_intent_id));
      const pendingAssignments = paidBookings.filter((row) => !row.provider_id && row.status === "created").length;
      const networkRelationships = network.filter((row) => row.status === "active" && (row.source_person_id === provider.id || row.target_person_id === provider.id)).length;
      const providerContributions = contributions.filter((row) => row.person_id === provider.id).length;
      const base = { ...provider, readinessSubmitted: Boolean(providerReadiness), existingClientBucket: providerReadiness?.existing_client_household_bucket ?? null, recruitmentSource: providerReadiness?.recruitment_source ?? null, verificationReviewCount: providerReviews.length, identityReviewHistory: providerReviews.some((row) => row.review_type === "identity"), backgroundReviewHistory: providerReviews.some((row) => row.review_type === "background"), identityVerifiedReview: reviewEvidence.identityVerifiedReview === true, backgroundClearReview: reviewEvidence.backgroundClearReview === true, latestVerificationReviewAt: providerReviews[0]?.reviewed_at ?? null, invitesIssued: providerInvites.length, invitesAccepted: providerInvites.filter((row) => Boolean(row.relationship_confirmed_at && row.referee_id)).length, relationships: providerRelationships.length, paidRelationshipBookings: paidBookings.length, relationshipAssignmentsPending: pendingAssignments, completedRelationshipServices: providerRelationships.reduce((sum, row) => sum + (row.completed_services_count ?? 0), 0), grossRelationshipCents: paidBookings.reduce((sum, row) => sum + (row.price_cents ?? 0), 0), platformFeeCents: paidBookings.reduce((sum, row) => sum + (row.platform_fee_cents ?? 0), 0), payoutReleasedCount: paidBookings.filter((row) => row.payout_released).length, hasNorthStar: northStarIds.has(provider.id), networkRelationships, contributions: providerContributions, collectiveProof: networkRelationships > 0 || providerContributions > 0, foundingActivity: providerInvites.length > 0 || providerRelationships.length > 0 || bookings.some((row) => row.service_relationship_id && relationshipProvider.get(row.service_relationship_id) === provider.id) };
      const guidance = pilotGuidance(base);
      return { ...base, pilotStage: guidance.stage, pilotStageOrder: guidance.stageOrder, blockers: guidance.blockers, nextAction: guidance.nextAction, nextActionTo: guidance.stage === "Application review" ? `${guidance.nextActionTo}?provider=${encodeURIComponent(provider.id)}` : guidance.nextActionTo };
    });
  }, [bookings, contributions, network, northStars, providers, readiness, referrals, relationships, verificationReviews]);

  const attentionQueue = useMemo(() => [...signals].sort((a, b) => a.pilotStageOrder - b.pilotStageOrder || a.created_at.localeCompare(b.created_at)), [signals]);
  const totals = useMemo(() => {
    const providerIds = new Set(providers.map((row) => row.id));
    const providerBroughtRelationshipIds = new Set(relationships.map((row) => row.id));
    const paidProviderBroughtBookings = bookings.filter((row) => row.service_relationship_id != null && providerBroughtRelationshipIds.has(row.service_relationship_id) && Boolean(row.stripe_payment_intent_id));
    const cspContributions = contributions.filter((row) => providerIds.has(row.person_id));
    const cspNetwork = network.filter((row) => row.status === "active" && (providerIds.has(row.source_person_id) || providerIds.has(row.target_person_id)));
    return { csp: signals.length, recruited: signals.filter((row) => row.recruitmentSource === "founding_circle").length, ready: signals.filter((row) => row.application_status === "approved" || row.marketplace_access).length, existingHouseholdSignal: signals.filter((row) => hasExistingHouseholds(row.existingClientBucket)).length, foundingActive: signals.filter((row) => row.foundingActivity).length, providersWithReviewHistory: signals.filter((row) => row.verificationReviewCount > 0).length, providersWithSuccessfulReviews: signals.filter((row) => row.identityVerifiedReview && row.backgroundClearReview).length, verificationReviews: verificationReviews.length, invites: referrals.length, accepted: referrals.filter((row) => Boolean(row.relationship_confirmed_at && row.referee_id)).length, relationships: relationships.length, paidBookings: paidProviderBroughtBookings.length, assignmentPending: signals.reduce((sum, row) => sum + row.relationshipAssignmentsPending, 0), collectiveProofProviders: signals.filter((row) => row.collectiveProof).length, contributions: cspContributions.length, activeNetwork: cspNetwork.length };
  }, [bookings, contributions, network, providers, referrals, relationships, signals, verificationReviews]);

  if (adminLoading || loading) return <p className="text-sm text-slate-500">Loading Founding Circle…</p>;
  if (!isAdmin) return <p className="text-sm text-slate-500">Admin access required.</p>;

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        eyebrow="Program"
        title="Founding Circle"
        description="Operational truth for the first CSP cohort—from readiness and independent review through relationship activation and collective proof."
        actions={<AdminSecondaryButton onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</AdminSecondaryButton>}
        meta={<span className="text-xs text-slate-500">{signals.length} CSPs · {attentionQueue.filter((row) => row.blockers.length > 0).length} need a next step · {totals.assignmentPending} awaiting Kinex</span>}
      />

      {error ? <AdminNotice tone="danger">{error}</AdminNotice> : null}

      <AdminTabs value={view} onChange={setView} items={[{ value: "attention", label: "Attention", count: attentionQueue.filter((row) => row.blockers.length > 0).length }, { value: "funnel", label: "Pilot funnel" }, { value: "providers", label: "All CSPs", count: signals.length }]} />

      {view === "attention" ? (
        attentionQueue.length === 0 ? <AdminEmptyState title="No CSP profiles yet" /> : <AdminTableShell><div className="grid grid-cols-[minmax(260px,1.2fr)_180px_minmax(320px,1.4fr)_190px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><span>CSP</span><span>Stage</span><span>Current blocker</span><span>Next action</span></div>{attentionQueue.map((provider) => <div key={provider.id} className="grid grid-cols-[minmax(260px,1.2fr)_180px_minmax(320px,1.4fr)_190px] items-start gap-4 border-b border-slate-200 px-5 py-4 last:border-b-0"><div><p className="text-sm font-semibold text-slate-950">{provider.full_name ?? "Unnamed CSP"}</p><p className="mt-1 text-[11px] text-slate-500">{provider.recruitmentSource === "founding_circle" ? "Founding recruit" : provider.recruitmentSource ?? "Organic / legacy"}</p></div><AdminStatus tone={provider.blockers.length ? "warning" : "success"}>{provider.pilotStage}</AdminStatus><div>{provider.blockers.length ? <ul className="space-y-1 text-xs leading-5 text-slate-600">{provider.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}</ul> : <p className="text-xs text-emerald-700">No launch blocker detected.</p>}</div><Link to={provider.nextActionTo} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#0000FE] hover:bg-slate-50">{provider.nextAction}</Link></div>)}</AdminTableShell>
      ) : null}

      {view === "funnel" ? (
        <div className="space-y-5">
          <AdminStatStrip items={[
            { label: "CSP funnel", value: totals.csp, detail: `${totals.ready} approved or marketplace-enabled` },
            { label: "Approval-grade review", value: `${totals.providersWithSuccessfulReviews}/${totals.csp}`, detail: `${totals.verificationReviews} durable review records` },
            { label: "Existing clients", value: `${totals.accepted}/${totals.invites}`, detail: `${totals.relationships} provider-brought relationships` },
            { label: "Paid relationship bookings", value: totals.paidBookings, detail: pilotRate == null ? "Pilot rate unavailable" : `${Math.round(pilotRate * 100)}% provider-brought platform rate` },
          ]} />
          <AdminStatStrip items={[
            { label: "Founding recruits", value: totals.recruited, detail: "Recruitment provenance only" },
            { label: "Existing-household signal", value: totals.existingHouseholdSignal, detail: "Self-reported 1+ households" },
            { label: "Collective proof CSPs", value: totals.collectiveProofProviders, detail: `${totals.activeNetwork} network ties` },
            { label: "Contributions", value: totals.contributions, detail: "Verified value returned" },
          ]} />
          <details className="rounded-2xl border border-slate-200 bg-white"><summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">Pilot interpretation</summary><p className="border-t border-slate-200 px-5 py-4 text-xs leading-5 text-slate-600">Recruitment source records how someone entered. It never changes approval, ranking, or marketplace eligibility. Approval-grade identity truth requires independent review of the currently registered evidence; existing households are relationship-continuity context, not a quality score.</p></details>
        </div>
      ) : null}

      {view === "providers" ? (
        signals.length === 0 ? <AdminEmptyState title="No CSP profiles yet" /> : <AdminTableShell><div className="grid grid-cols-[minmax(240px,1.2fr)_170px_160px_160px_160px_minmax(220px,1fr)] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><span>CSP</span><span>Stage</span><span>Reviews</span><span>Relationships</span><span>Paid bookings</span><span>Growth / collective</span></div>{signals.map((provider) => <div key={provider.id} className="grid grid-cols-[minmax(240px,1.2fr)_170px_160px_160px_160px_minmax(220px,1fr)] items-center gap-4 border-b border-slate-200 px-5 py-4 text-xs last:border-b-0"><div><p className="text-sm font-semibold text-slate-950">{provider.full_name ?? "Unnamed CSP"}</p><p className="mt-1 text-[11px] text-slate-500">{provider.existingClientBucket ? EXISTING_CLIENT_LABELS[provider.existingClientBucket] : "No household signal"}</p></div><AdminStatus tone={provider.blockers.length ? "warning" : "success"}>{provider.pilotStage}</AdminStatus><div><p className="font-semibold text-slate-900">{provider.verificationReviewCount}</p><p className="mt-1 text-[11px] text-slate-500">identity {provider.identityVerifiedReview ? "✓" : "○"} · background {provider.backgroundClearReview ? "✓" : "○"}</p></div><div><p className="font-semibold text-slate-900">{provider.relationships}</p><p className="mt-1 text-[11px] text-slate-500">{provider.invitesAccepted}/{provider.invitesIssued} invites accepted</p></div><div><p className="font-semibold text-slate-900">{provider.paidRelationshipBookings}</p><p className="mt-1 text-[11px] text-slate-500">{provider.completedRelationshipServices} completed · {money(provider.platformFeeCents)} fees</p></div><div><p className="text-slate-600">North Star {provider.hasNorthStar ? "✓" : "○"} · network {provider.networkRelationships} · contributions {provider.contributions}</p><Link to={provider.nextActionTo} className="mt-1 inline-block font-semibold text-[#0000FE] hover:underline">{provider.nextAction} →</Link></div></div>)}</AdminTableShell>
      ) : null}
    </AdminPage>
  );
}
