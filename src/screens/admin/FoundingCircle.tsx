import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getProviderApprovalReviewEvidence } from "../../lib/cspActivation";
import { useIsAdmin } from "../../lib/useIsAdmin";
import { supabase } from "../../lib/supabase";
import { adminTheme } from "../../theme/adminTheme";

type ProviderRow = {
  id: string;
  full_name: string | null;
  created_at: string;
  application_status: string | null;
  readiness_status: string | null;
  is_onboarded: boolean | null;
  marketplace_access: boolean | null;
  stripe_connect_ready: boolean | null;
  identity_document_path: string | null;
  identity_status: string | null;
  background_check_status: string | null;
  insurance_status: string | null;
};

type ExistingClientBucket = "none" | "1_2" | "3_5" | "6_plus" | "prefer_not_to_say";

type ReadinessRow = {
  provider_id: string;
  submitted_at: string | null;
  existing_client_household_bucket: ExistingClientBucket | null;
  recruitment_source: string | null;
};

type ReferralRow = {
  id: string;
  referrer_id: string;
  referee_id: string | null;
  relationship_confirmed_at: string | null;
  created_at: string;
};

type RelationshipRow = {
  id: string;
  provider_id: string;
  status: string;
  completed_services_count: number;
  created_at: string;
};

type BookingRow = {
  id: string;
  service_relationship_id: string | null;
  provider_id: string | null;
  status: string;
  price_cents: number | null;
  platform_fee_cents: number | null;
  stripe_payment_intent_id: string | null;
  payout_released: boolean | null;
  created_at: string;
};

type VerificationReviewRow = {
  id: string;
  provider_id: string;
  review_type: string;
  outcome: string;
  reviewed_by: string;
  reviewed_at: string;
  reviewed_evidence_ref: string | null;
};

type NorthStarRow = { person_id: string; status: string };
type NetworkRow = { source_person_id: string; target_person_id: string; status: string };
type ContributionRow = { person_id: string; beneficiary_person_id: string | null };

type PilotGuidance = {
  stage: string;
  stageOrder: number;
  nextAction: string;
  nextActionTo: string;
  blockers: string[];
};

type ProviderSignal = ProviderRow & {
  readinessSubmitted: boolean;
  existingClientBucket: ExistingClientBucket | null;
  recruitmentSource: string | null;
  verificationReviewCount: number;
  identityReviewHistory: boolean;
  backgroundReviewHistory: boolean;
  identityVerifiedReview: boolean;
  backgroundClearReview: boolean;
  latestVerificationReviewAt: string | null;
  invitesIssued: number;
  invitesAccepted: number;
  relationships: number;
  paidRelationshipBookings: number;
  relationshipAssignmentsPending: number;
  completedRelationshipServices: number;
  grossRelationshipCents: number;
  platformFeeCents: number;
  payoutReleasedCount: number;
  hasNorthStar: boolean;
  networkRelationships: number;
  contributions: number;
  collectiveProof: boolean;
  foundingActivity: boolean;
  pilotStage: string;
  pilotStageOrder: number;
  blockers: string[];
  nextAction: string;
  nextActionTo: string;
};

const EXISTING_CLIENT_LABELS: Record<ExistingClientBucket, string> = {
  none: "No existing households reported",
  "1_2": "1–2 existing households",
  "3_5": "3–5 existing households",
  "6_plus": "6+ existing households",
  prefer_not_to_say: "Existing households not shared",
};

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
      <p className="text-xs font-medium" style={{ color: adminTheme.textSecondary }}>{label}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>{value}</p>
      <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>{detail}</p>
    </div>
  );
}

function StatusPill({ ok, children }: { ok: boolean; children: string }) {
  return (
    <span
      className="rounded-full border px-2 py-1 text-[11px] font-medium"
      style={{
        borderColor: ok ? "rgba(34,197,94,.35)" : adminTheme.border,
        backgroundColor: ok ? "rgba(34,197,94,.08)" : adminTheme.surface,
        color: ok ? "#15803d" : adminTheme.textSecondary,
      }}
    >
      {children}
    </span>
  );
}

function StagePill({ children }: { children: string }) {
  return (
    <span
      className="rounded-full border px-2 py-1 text-[11px] font-semibold"
      style={{ borderColor: "rgba(234,179,8,.35)", backgroundColor: "rgba(234,179,8,.09)", color: "#854d0e" }}
    >
      {children}
    </span>
  );
}

function hasExistingHouseholds(bucket: ExistingClientBucket | null): boolean {
  return bucket === "1_2" || bucket === "3_5" || bucket === "6_plus";
}

function isVerified(value: string | null): boolean {
  return ["verified", "approved", "clear", "complete", "completed"].includes((value ?? "").trim().toLowerCase());
}

function pilotGuidance(provider: Omit<ProviderSignal, "pilotStage" | "pilotStageOrder" | "blockers" | "nextAction" | "nextActionTo">): PilotGuidance {
  if (!provider.readinessSubmitted) {
    return {
      stage: "Readiness",
      stageOrder: 10,
      nextAction: "Complete readiness",
      nextActionTo: "/admin/full-app/csp/candidate-readiness",
      blockers: ["Candidate readiness has not been submitted."],
    };
  }

  if (!provider.is_onboarded) {
    return {
      stage: "Onboarding",
      stageOrder: 20,
      nextAction: "Complete onboarding",
      nextActionTo: "/admin/full-app/csp/onboarding",
      blockers: ["CSP onboarding is not complete."],
    };
  }

  if (provider.application_status !== "approved") {
    const blockers = [`Application: ${provider.application_status ?? "not submitted"}.`];
    const identityVerified = isVerified(provider.identity_status);
    const backgroundVerified = isVerified(provider.background_check_status);

    if (!identityVerified) blockers.push(`Identity status: ${provider.identity_status ?? "not started"}.`);
    if (!provider.identityVerifiedReview) {
      blockers.push(
        provider.identityReviewHistory
          ? "Identity review history exists, but no durable independent verified review matches the currently registered identity evidence."
          : identityVerified
            ? "Identity audit gap: status is verified, but no independent verified review of the current identity evidence is recorded."
            : "Identity: no independent review history recorded yet."
      );
    }

    if (!backgroundVerified) blockers.push(`Background status: ${provider.background_check_status ?? "not started"}.`);
    if (!provider.backgroundClearReview) {
      blockers.push(
        provider.backgroundReviewHistory
          ? "Background review history exists, but no durable independent background review with outcome clear is recorded."
          : backgroundVerified
            ? "Background audit gap: status is cleared, but no independent background review history is recorded."
            : "Background: no independent review history recorded yet."
      );
    }

    return {
      stage: "Application review",
      stageOrder: 30,
      nextAction:
        !provider.identityVerifiedReview || !provider.backgroundClearReview
          ? "Record independent review"
          : "Complete application review",
      nextActionTo: "/admin/providers",
      blockers,
    };
  }

  if (!provider.stripe_connect_ready) {
    return {
      stage: "Payout setup",
      stageOrder: 40,
      nextAction: "Finish payout setup",
      nextActionTo: "/admin/full-app/csp/application",
      blockers: ["Stripe Connect payout readiness is not complete."],
    };
  }

  if (provider.invitesIssued === 0 && hasExistingHouseholds(provider.existingClientBucket)) {
    return {
      stage: "Relationship activation",
      stageOrder: 50,
      nextAction: "Invite existing client",
      nextActionTo: "/admin/full-app/csp/existing-clients",
      blockers: ["Existing households were reported, but no existing-client invitation has been issued."],
    };
  }

  if (provider.invitesIssued > provider.invitesAccepted) {
    return {
      stage: "Customer acceptance",
      stageOrder: 60,
      nextAction: "Get client acceptance",
      nextActionTo: "/admin/full-app/csp/existing-clients",
      blockers: [`${provider.invitesIssued - provider.invitesAccepted} existing-client invitation${provider.invitesIssued - provider.invitesAccepted === 1 ? " is" : "s are"} still awaiting customer confirmation.`],
    };
  }

  if (provider.relationships === 0) {
    return {
      stage: "First relationship",
      stageOrder: 70,
      nextAction: hasExistingHouseholds(provider.existingClientBucket) ? "Confirm first relationship" : "Choose first relationship path",
      nextActionTo: hasExistingHouseholds(provider.existingClientBucket) ? "/admin/full-app/csp/existing-clients" : "/admin/full-app/csp",
      blockers: [
        hasExistingHouseholds(provider.existingClientBucket)
          ? "No durable provider-brought relationship exists yet."
          : "No durable relationship exists yet. Existing clients are optional; choose the first legitimate relationship path without manufacturing provenance.",
      ],
    };
  }

  if (provider.paidRelationshipBookings === 0) {
    return {
      stage: "First paid relationship",
      stageOrder: 80,
      nextAction: "Book first relationship service",
      nextActionTo: "/admin/full-app/csp",
      blockers: ["A durable relationship exists, but it has not produced a paid Cleanr booking yet."],
    };
  }

  if (provider.relationshipAssignmentsPending > 0) {
    return {
      stage: "Kinex reconciliation",
      stageOrder: 90,
      nextAction: "Watch Kinex handoff",
      nextActionTo: "/admin/ops",
      blockers: [`${provider.relationshipAssignmentsPending} paid relationship booking${provider.relationshipAssignmentsPending === 1 ? " is" : "s are"} awaiting formal Kinex assignment reconciliation.`],
    };
  }

  if (provider.completedRelationshipServices === 0) {
    return {
      stage: "First completed service",
      stageOrder: 100,
      nextAction: "Complete first relationship visit",
      nextActionTo: "/admin/full-app/csp/jobs",
      blockers: ["The relationship has paid booking history but no confirmed completed service yet."],
    };
  }

  if (!provider.hasNorthStar) {
    return {
      stage: "North Star",
      stageOrder: 110,
      nextAction: "Capture North Star",
      nextActionTo: "/admin/full-app/csp/growth/milestones",
      blockers: ["No persistent North Star has been recorded yet."],
    };
  }

  if (!provider.collectiveProof) {
    return {
      stage: "Collective proof",
      stageOrder: 120,
      nextAction: "Create collective proof",
      nextActionTo: "/admin/full-app/csp/growth/network",
      blockers: ["The pilot still needs a real network tie or contribution showing value created beyond the individual transaction."],
    };
  }

  return {
    stage: "Pilot active",
    stageOrder: 200,
    nextAction: "Inspect relationship health",
    nextActionTo: "/admin/full-app",
    blockers: [],
  };
}

export function FoundingCircle() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
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
    setLoading(true);
    setError(null);
    try {
      const [p, ready, reviews, refs, rels, b, ns, net, contrib, rate] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,created_at,application_status,readiness_status,is_onboarded,marketplace_access,stripe_connect_ready,identity_document_path,identity_status,background_check_status,insurance_status")
          .eq("role", "csp")
          .order("created_at", { ascending: true }),
        supabase
          .from("provider_readiness_profiles")
          .select("provider_id,submitted_at,existing_client_household_bucket,recruitment_source"),
        supabase
          .from("provider_verification_reviews")
          .select("id,provider_id,review_type,outcome,reviewed_by,reviewed_at,reviewed_evidence_ref")
          .order("reviewed_at", { ascending: false }),
        supabase
          .from("referrals")
          .select("id,referrer_id,referee_id,relationship_confirmed_at,created_at")
          .eq("referral_kind", "existing_client"),
        supabase
          .from("service_relationships")
          .select("id,provider_id,status,completed_services_count,created_at")
          .eq("origin", "provider_brought"),
        supabase
          .from("bookings")
          .select("id,service_relationship_id,provider_id,status,price_cents,platform_fee_cents,stripe_payment_intent_id,payout_released,created_at")
          .not("service_relationship_id", "is", null),
        supabase.from("north_stars").select("person_id,status"),
        supabase.from("network_relationships").select("source_person_id,target_person_id,status"),
        supabase.from("contributions").select("person_id,beneficiary_person_id"),
        supabase.from("platform_settings").select("value").eq("key", "provider_brought_platform_fee_rate").maybeSingle(),
      ]);

      for (const result of [p, ready, reviews, refs, rels, b, ns, net, contrib, rate]) {
        if (result.error) throw result.error;
      }

      setProviders((p.data ?? []) as ProviderRow[]);
      setReadiness((ready.data ?? []) as ReadinessRow[]);
      setVerificationReviews((reviews.data ?? []) as VerificationReviewRow[]);
      setReferrals((refs.data ?? []) as ReferralRow[]);
      setRelationships((rels.data ?? []) as RelationshipRow[]);
      setBookings((b.data ?? []) as BookingRow[]);
      setNorthStars((ns.data ?? []) as NorthStarRow[]);
      setNetwork((net.data ?? []) as NetworkRow[]);
      setContributions((contrib.data ?? []) as ContributionRow[]);

      const parsedRate = Number((rate.data as { value?: string } | null)?.value);
      setPilotRate(Number.isFinite(parsedRate) ? parsedRate : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Founding Circle launch truth");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin]);

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
      const relationshipBookings = bookings.filter(
        (row) => row.service_relationship_id != null && relationshipIds.has(row.service_relationship_id)
      );
      const paidBookings = relationshipBookings.filter((row) => Boolean(row.stripe_payment_intent_id));
      const pendingAssignments = paidBookings.filter((row) => !row.provider_id && row.status === "created").length;
      const networkRelationships = network.filter(
        (row) => row.status === "active" && (row.source_person_id === provider.id || row.target_person_id === provider.id)
      ).length;
      const providerContributions = contributions.filter((row) => row.person_id === provider.id).length;

      const base = {
        ...provider,
        readinessSubmitted: Boolean(providerReadiness),
        existingClientBucket: providerReadiness?.existing_client_household_bucket ?? null,
        recruitmentSource: providerReadiness?.recruitment_source ?? null,
        verificationReviewCount: providerReviews.length,
        identityReviewHistory: providerReviews.some((row) => row.review_type === "identity"),
        backgroundReviewHistory: providerReviews.some((row) => row.review_type === "background"),
        identityVerifiedReview: reviewEvidence.identityVerifiedReview === true,
        backgroundClearReview: reviewEvidence.backgroundClearReview === true,
        latestVerificationReviewAt: providerReviews[0]?.reviewed_at ?? null,
        invitesIssued: providerInvites.length,
        invitesAccepted: providerInvites.filter((row) => Boolean(row.relationship_confirmed_at && row.referee_id)).length,
        relationships: providerRelationships.length,
        paidRelationshipBookings: paidBookings.length,
        relationshipAssignmentsPending: pendingAssignments,
        completedRelationshipServices: providerRelationships.reduce((sum, row) => sum + (row.completed_services_count ?? 0), 0),
        grossRelationshipCents: paidBookings.reduce((sum, row) => sum + (row.price_cents ?? 0), 0),
        platformFeeCents: paidBookings.reduce((sum, row) => sum + (row.platform_fee_cents ?? 0), 0),
        payoutReleasedCount: paidBookings.filter((row) => row.payout_released).length,
        hasNorthStar: northStarIds.has(provider.id),
        networkRelationships,
        contributions: providerContributions,
        collectiveProof: networkRelationships > 0 || providerContributions > 0,
        foundingActivity: providerInvites.length > 0 || providerRelationships.length > 0 || bookings.some((row) => row.service_relationship_id && relationshipProvider.get(row.service_relationship_id) === provider.id),
      };
      const guidance = pilotGuidance(base);
      return {
        ...base,
        pilotStage: guidance.stage,
        pilotStageOrder: guidance.stageOrder,
        blockers: guidance.blockers,
        nextAction: guidance.nextAction,
        nextActionTo: guidance.stage === "Application review" ? `${guidance.nextActionTo}?provider=${encodeURIComponent(provider.id)}` : guidance.nextActionTo,
      };
    });
  }, [bookings, contributions, network, northStars, providers, readiness, referrals, relationships, verificationReviews]);

  const attentionQueue = useMemo(
    () => [...signals].sort((a, b) => a.pilotStageOrder - b.pilotStageOrder || a.created_at.localeCompare(b.created_at)),
    [signals]
  );

  const totals = useMemo(() => {
    const providerIds = new Set(providers.map((row) => row.id));
    const providerBroughtRelationshipIds = new Set(relationships.map((row) => row.id));
    const paidProviderBroughtBookings = bookings.filter((row) => row.service_relationship_id != null && providerBroughtRelationshipIds.has(row.service_relationship_id) && Boolean(row.stripe_payment_intent_id));
    const cspContributions = contributions.filter((row) => providerIds.has(row.person_id));
    const cspNetwork = network.filter((row) => row.status === "active" && (providerIds.has(row.source_person_id) || providerIds.has(row.target_person_id)));

    return {
      csp: signals.length,
      recruited: signals.filter((row) => row.recruitmentSource === "founding_circle").length,
      ready: signals.filter((row) => row.application_status === "approved" || row.marketplace_access).length,
      existingHouseholdSignal: signals.filter((row) => hasExistingHouseholds(row.existingClientBucket)).length,
      foundingActive: signals.filter((row) => row.foundingActivity).length,
      providersWithReviewHistory: signals.filter((row) => row.verificationReviewCount > 0).length,
      providersWithSuccessfulReviews: signals.filter((row) => row.identityVerifiedReview && row.backgroundClearReview).length,
      verificationReviews: verificationReviews.length,
      invites: referrals.length,
      accepted: referrals.filter((row) => Boolean(row.relationship_confirmed_at && row.referee_id)).length,
      relationships: relationships.length,
      paidBookings: paidProviderBroughtBookings.length,
      assignmentPending: signals.reduce((sum, row) => sum + row.relationshipAssignmentsPending, 0),
      collectiveProofProviders: signals.filter((row) => row.collectiveProof).length,
      contributions: cspContributions.length,
      activeNetwork: cspNetwork.length,
    };
  }, [bookings, contributions, network, providers, referrals, relationships, signals, verificationReviews]);

  if (adminLoading || loading) return <p className="text-sm" style={{ color: adminTheme.textSecondary }}>Loading Founding Circle launch truth…</p>;
  if (!isAdmin) return <p className="text-sm" style={{ color: adminTheme.textSecondary }}>Admin access required.</p>;

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: adminTheme.primary }}>Living laboratory</p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>Founding Circle</h1>
          <p className="mt-1 max-w-3xl text-sm" style={{ color: adminTheme.textSecondary }}>
            Launch truth for the first CSPs: recruitment → readiness → independent review → existing-client invitation → consented relationship → paid service → collective activity. Recruitment source is acquisition provenance only; it never changes approval, ranking, or marketplace eligibility.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-lg px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: adminTheme.primary }}>Refresh</button>
      </header>

      {error ? <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: adminTheme.border, color: "#b91c1c" }}>{error}</div> : null}

      <section className="rounded-xl border" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4" style={{ borderColor: adminTheme.border }}>
          <div>
            <h2 className="text-sm font-semibold">Pilot attention queue</h2>
            <p className="mt-1 max-w-3xl text-xs leading-5" style={{ color: adminTheme.textSecondary }}>
              Verification status, durable review history, and approval-grade review truth are separate signals. Identity approval-grade truth requires a successful independent review of the currently registered ID evidence; an older verified review remains history, not current approval proof. The queue does not change CSP eligibility, route bookings, or manufacture relationship provenance.
            </p>
          </div>
          <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}>
            <span className="font-semibold">{attentionQueue.filter((row) => row.blockers.length > 0).length}</span> need a next step · <span className="font-semibold">{totals.verificationReviews}</span> durable reviews · <span className="font-semibold">{totals.assignmentPending}</span> awaiting Kinex
          </div>
        </div>

        <div className="divide-y" style={{ borderColor: adminTheme.border }}>
          {attentionQueue.length === 0 ? (
            <p className="p-4 text-sm" style={{ color: adminTheme.textSecondary }}>No CSP profiles yet.</p>
          ) : (
            attentionQueue.map((provider, index) => (
              <article key={provider.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: adminTheme.textSecondary }}>#{index + 1}</span>
                      <p className="font-medium">{provider.full_name ?? "Unnamed CSP"}</p>
                      <StagePill>{provider.pilotStage}</StagePill>
                      {provider.recruitmentSource === "founding_circle" ? <StatusPill ok>Founding recruit</StatusPill> : null}
                      <StatusPill ok={provider.identityVerifiedReview}>identity current-evidence review</StatusPill>
                      <StatusPill ok={provider.backgroundClearReview}>background clear review</StatusPill>
                    </div>
                    <p className="mt-1 text-[11px]" style={{ color: adminTheme.textSecondary }}>{provider.id}</p>

                    {provider.blockers.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-semibold text-amber-900">Current blocker{provider.blockers.length === 1 ? "" : "s"}</p>
                        <ul className="mt-1 space-y-1 text-xs leading-5 text-amber-900">
                          {provider.blockers.map((blocker) => <li key={blocker}>• {blocker}</li>)}
                        </ul>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-emerald-700">No launch blocker detected. Continue monitoring relationship health and value circulation.</p>
                    )}
                  </div>

                  <div className="w-full rounded-lg border p-3 sm:w-64" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}>
                    <p className="text-[11px] font-medium" style={{ color: adminTheme.textSecondary }}>Next action</p>
                    <p className="mt-1 text-sm font-semibold" style={{ color: adminTheme.textPrimary }}>{provider.nextAction}</p>
                    <Link to={provider.nextActionTo} className="mt-2 inline-block text-xs font-semibold underline" style={{ color: adminTheme.primary }}>
                      Open the right surface →
                    </Link>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Metric label="CSP funnel" value={totals.csp} detail={`${totals.ready} approved or marketplace-enabled`} />
        <Metric label="Approval-grade review" value={`${totals.providersWithSuccessfulReviews}/${totals.csp}`} detail={`${totals.providersWithReviewHistory} with any review history · ${totals.verificationReviews} durable records`} />
        <Metric label="Founding recruitment" value={totals.recruited} detail="Entered through the Founding Circle recruiting path" />
        <Metric label="Existing-household signal" value={totals.existingHouseholdSignal} detail="Self-reported 1+ households; recruitment context only" />
        <Metric label="Existing clients" value={`${totals.accepted}/${totals.invites}`} detail={`${totals.relationships} provider-brought durable relationships`} />
        <Metric label="Paid relationship bookings" value={totals.paidBookings} detail={pilotRate == null ? "Pilot rate unavailable" : `${Math.round(pilotRate * 100)}% provider-brought platform rate`} />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
          <p className="text-sm font-semibold">Collective proof</p>
          <p className="mt-2 text-2xl font-semibold">{totals.contributions + totals.activeNetwork}</p>
          <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>
            {totals.contributions} CSP contribution records · {totals.activeNetwork} active network relationships involving a CSP · {totals.collectiveProofProviders} CSPs with at least one collective signal. The pilot needs at least one real coverage, referral, mentorship, knowledge-transfer, or other collective event—not just paid cleanings.
          </p>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
          <p className="text-sm font-semibold">Pilot interpretation</p>
          <p className="mt-2 text-xs leading-5" style={{ color: adminTheme.textSecondary }}>
            “Founding recruit” says how someone entered. Verification status says current profile state; review history proves an independent review action was durably recorded; approval-grade identity truth additionally requires that the successful review reference the currently registered ID evidence. Existing households indicate where relationship continuity can be tested quickly. None of those are quality scores or permanent tiers.
          </p>
        </div>
      </section>

      <section className="rounded-xl border" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
        <div className="border-b p-4" style={{ borderColor: adminTheme.border }}>
          <h2 className="text-sm font-semibold">CSP launch board</h2>
          <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>All CSPs remain visible so nobody disappears between signup and first relationship. Next action is operational guidance, not an automated eligibility decision.</p>
        </div>
        <div className="divide-y" style={{ borderColor: adminTheme.border }}>
          {signals.length === 0 ? <p className="p-4 text-sm" style={{ color: adminTheme.textSecondary }}>No CSP profiles yet.</p> : signals.map((provider) => (
            <article key={provider.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{provider.full_name ?? "Unnamed CSP"}</p>
                    <StagePill>{provider.pilotStage}</StagePill>
                    {provider.recruitmentSource === "founding_circle" ? <StatusPill ok>Founding recruit</StatusPill> : null}
                    {provider.foundingActivity ? <StatusPill ok>Founding activity</StatusPill> : null}
                    {provider.existingClientBucket ? <StatusPill ok={hasExistingHouseholds(provider.existingClientBucket)}>{EXISTING_CLIENT_LABELS[provider.existingClientBucket]}</StatusPill> : null}
                  </div>
                  <p className="mt-1 text-[11px]" style={{ color: adminTheme.textSecondary }}>{provider.id}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: adminTheme.textPrimary }}>Next: {provider.nextAction}</span>
                    <Link to={provider.nextActionTo} className="text-xs font-semibold underline" style={{ color: adminTheme.primary }}>open →</Link>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusPill ok={provider.readinessSubmitted}>readiness</StatusPill>
                  <StatusPill ok={provider.identityVerifiedReview}>identity current-evidence review</StatusPill>
                  <StatusPill ok={provider.backgroundClearReview}>background clear review</StatusPill>
                  <StatusPill ok={provider.application_status === "approved"}>approved</StatusPill>
                  <StatusPill ok={Boolean(provider.stripe_connect_ready)}>payout-ready</StatusPill>
                  <StatusPill ok={Boolean(provider.marketplace_access)}>marketplace</StatusPill>
                  <StatusPill ok={provider.relationshipAssignmentsPending === 0}>Kinex clear</StatusPill>
                  <StatusPill ok={provider.hasNorthStar}>North Star</StatusPill>
                  <StatusPill ok={provider.collectiveProof}>collective proof</StatusPill>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <Metric label="Review records" value={provider.verificationReviewCount} detail={provider.latestVerificationReviewAt ? `Latest ${new Date(provider.latestVerificationReviewAt).toLocaleString()} · identity history ${provider.identityReviewHistory ? "yes" : "no"} · background history ${provider.backgroundReviewHistory ? "yes" : "no"}` : "No independent review history"} />
                <Metric label="Invites" value={provider.invitesIssued} detail={`${provider.invitesAccepted} accepted`} />
                <Metric label="Relationships" value={provider.relationships} detail="provider-brought" />
                <Metric label="Paid bookings" value={provider.paidRelationshipBookings} detail={`${provider.relationshipAssignmentsPending} awaiting reconciliation · ${provider.completedRelationshipServices} completed together`} />
                <Metric label="Network" value={provider.networkRelationships} detail="active recorded relationships" />
                <Metric label="Contributions" value={provider.contributions} detail={`${provider.payoutReleasedCount} payouts released · ${money(provider.platformFeeCents)} platform fee`} />
              </div>

              <p className="mt-3 text-[11px]" style={{ color: adminTheme.textSecondary }}>
                recruitment: {provider.recruitmentSource ?? "organic / legacy"} · application: {provider.application_status ?? "not submitted"} · readiness: {provider.readiness_status ?? "not set"} · identity status: {provider.identity_status ?? "not set"} · background status: {provider.background_check_status ?? "not set"} · insurance: {provider.insurance_status ?? "not set"}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
