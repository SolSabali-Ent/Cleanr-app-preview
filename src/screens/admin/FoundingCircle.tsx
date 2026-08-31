import { useEffect, useMemo, useState } from "react";
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
  identity_status: string | null;
  background_check_status: string | null;
  insurance_status: string | null;
};

type ExistingClientBucket = "none" | "1_2" | "3_5" | "6_plus" | "prefer_not_to_say";

type ReadinessRow = {
  provider_id: string;
  submitted_at: string | null;
  existing_client_household_bucket: ExistingClientBucket | null;
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

type NorthStarRow = { person_id: string; status: string };
type NetworkRow = { source_person_id: string; target_person_id: string; status: string };
type ContributionRow = { person_id: string; beneficiary_person_id: string | null };

type ProviderSignal = ProviderRow & {
  readinessSubmitted: boolean;
  existingClientBucket: ExistingClientBucket | null;
  invitesIssued: number;
  invitesAccepted: number;
  relationships: number;
  paidRelationshipBookings: number;
  completedRelationshipServices: number;
  grossRelationshipCents: number;
  platformFeeCents: number;
  payoutReleasedCount: number;
  hasNorthStar: boolean;
  networkRelationships: number;
  contributions: number;
  foundingActivity: boolean;
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

function hasExistingHouseholds(bucket: ExistingClientBucket | null): boolean {
  return bucket === "1_2" || bucket === "3_5" || bucket === "6_plus";
}

export function FoundingCircle() {
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [readiness, setReadiness] = useState<ReadinessRow[]>([]);
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
      const [p, ready, refs, rels, b, ns, net, contrib, rate] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,full_name,created_at,application_status,readiness_status,is_onboarded,marketplace_access,stripe_connect_ready,identity_status,background_check_status,insurance_status")
          .eq("role", "csp")
          .order("created_at", { ascending: true }),
        supabase
          .from("provider_readiness_profiles")
          .select("provider_id,submitted_at,existing_client_household_bucket"),
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

      for (const result of [p, ready, refs, rels, b, ns, net, contrib, rate]) {
        if (result.error) throw result.error;
      }

      setProviders((p.data ?? []) as ProviderRow[]);
      setReadiness((ready.data ?? []) as ReadinessRow[]);
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
      const providerInvites = referrals.filter((row) => row.referrer_id === provider.id);
      const providerRelationships = relationships.filter((row) => row.provider_id === provider.id);
      const relationshipIds = new Set(providerRelationships.map((row) => row.id));
      const relationshipBookings = bookings.filter(
        (row) => row.service_relationship_id != null && relationshipIds.has(row.service_relationship_id)
      );
      const paidBookings = relationshipBookings.filter((row) => Boolean(row.stripe_payment_intent_id));
      const networkRelationships = network.filter(
        (row) => row.source_person_id === provider.id || row.target_person_id === provider.id
      ).length;
      const providerContributions = contributions.filter((row) => row.person_id === provider.id).length;

      return {
        ...provider,
        readinessSubmitted: Boolean(providerReadiness),
        existingClientBucket: providerReadiness?.existing_client_household_bucket ?? null,
        invitesIssued: providerInvites.length,
        invitesAccepted: providerInvites.filter((row) => Boolean(row.relationship_confirmed_at && row.referee_id)).length,
        relationships: providerRelationships.length,
        paidRelationshipBookings: paidBookings.length,
        completedRelationshipServices: providerRelationships.reduce(
          (sum, row) => sum + (row.completed_services_count ?? 0), 0
        ),
        grossRelationshipCents: paidBookings.reduce((sum, row) => sum + (row.price_cents ?? 0), 0),
        platformFeeCents: paidBookings.reduce((sum, row) => sum + (row.platform_fee_cents ?? 0), 0),
        payoutReleasedCount: paidBookings.filter((row) => row.payout_released).length,
        hasNorthStar: northStarIds.has(provider.id),
        networkRelationships,
        contributions: providerContributions,
        foundingActivity: providerInvites.length > 0 || providerRelationships.length > 0 ||
          bookings.some((row) => row.service_relationship_id && relationshipProvider.get(row.service_relationship_id) === provider.id),
      };
    });
  }, [bookings, contributions, network, northStars, providers, readiness, referrals, relationships]);

  const totals = useMemo(() => {
    const providerIds = new Set(providers.map((row) => row.id));
    const providerBroughtRelationshipIds = new Set(relationships.map((row) => row.id));
    const paidProviderBroughtBookings = bookings.filter(
      (row) => row.service_relationship_id != null &&
        providerBroughtRelationshipIds.has(row.service_relationship_id) &&
        Boolean(row.stripe_payment_intent_id)
    );
    const cspContributions = contributions.filter((row) => providerIds.has(row.person_id));
    const cspNetwork = network.filter(
      (row) => row.status === "active" &&
        (providerIds.has(row.source_person_id) || providerIds.has(row.target_person_id))
    );

    return {
      csp: signals.length,
      ready: signals.filter((row) => row.application_status === "approved" || row.marketplace_access).length,
      existingHouseholdSignal: signals.filter((row) => hasExistingHouseholds(row.existingClientBucket)).length,
      foundingActive: signals.filter((row) => row.foundingActivity).length,
      invites: referrals.length,
      accepted: referrals.filter((row) => Boolean(row.relationship_confirmed_at && row.referee_id)).length,
      relationships: relationships.length,
      paidBookings: paidProviderBroughtBookings.length,
      contributions: cspContributions.length,
      activeNetwork: cspNetwork.length,
    };
  }, [bookings, contributions, network, providers, referrals, relationships, signals]);

  if (adminLoading || loading) {
    return <p className="text-sm" style={{ color: adminTheme.textSecondary }}>Loading Founding Circle launch truth…</p>;
  }
  if (!isAdmin) {
    return <p className="text-sm" style={{ color: adminTheme.textSecondary }}>Admin access required.</p>;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: adminTheme.primary }}>Living laboratory</p>
          <h1 className="mt-1 text-2xl font-semibold" style={{ color: adminTheme.textPrimary }}>Founding Circle</h1>
          <p className="mt-1 max-w-3xl text-sm" style={{ color: adminTheme.textSecondary }}>
            Launch truth for the first CSPs: readiness → existing-client invitation → consented relationship → paid service → collective activity. Existing-household counts are recruitment context only; they do not change approval or marketplace eligibility.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg px-4 py-2 text-xs font-semibold text-white"
          style={{ backgroundColor: adminTheme.primary }}
        >
          Refresh
        </button>
      </header>

      {error ? (
        <div className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: adminTheme.border, color: "#b91c1c" }}>{error}</div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="CSP funnel" value={totals.csp} detail={`${totals.ready} approved or marketplace-enabled`} />
        <Metric label="Existing-household signal" value={totals.existingHouseholdSignal} detail="Self-reported 1+ households; recruitment context only" />
        <Metric label="Founding activity" value={totals.foundingActive} detail="CSPs with an existing-client invite or relationship" />
        <Metric label="Existing clients" value={`${totals.accepted}/${totals.invites}`} detail={`${totals.relationships} provider-brought durable relationships`} />
        <Metric label="Paid relationship bookings" value={totals.paidBookings} detail={pilotRate == null ? "Pilot rate unavailable" : `${Math.round(pilotRate * 100)}% provider-brought platform rate`} />
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
          <p className="text-sm font-semibold">Collective proof</p>
          <p className="mt-2 text-2xl font-semibold">{totals.contributions + totals.activeNetwork}</p>
          <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>
            {totals.contributions} CSP contribution records · {totals.activeNetwork} active network relationships involving a CSP. The pilot needs at least one real coverage, referral, mentorship, knowledge-transfer, or other collective event—not just paid cleanings.
          </p>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
          <p className="text-sm font-semibold">Pilot interpretation</p>
          <p className="mt-2 text-xs leading-5" style={{ color: adminTheme.textSecondary }}>
            “Founding activity” is behavioral, not a permanent tier. Existing households tell us where relationship continuity can be tested quickly, but they are not a quality score. Approval, marketplace access, and payout readiness remain separate operational truths.
          </p>
        </div>
      </section>

      <section className="rounded-xl border" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
        <div className="border-b p-4" style={{ borderColor: adminTheme.border }}>
          <h2 className="text-sm font-semibold">CSP launch board</h2>
          <p className="mt-1 text-xs" style={{ color: adminTheme.textSecondary }}>All CSPs remain visible so nobody disappears between signup and first relationship.</p>
        </div>
        <div className="divide-y" style={{ borderColor: adminTheme.border }}>
          {signals.length === 0 ? (
            <p className="p-4 text-sm" style={{ color: adminTheme.textSecondary }}>No CSP profiles yet.</p>
          ) : signals.map((provider) => (
            <article key={provider.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{provider.full_name ?? "Unnamed CSP"}</p>
                    {provider.foundingActivity ? <StatusPill ok>Founding activity</StatusPill> : null}
                    {provider.existingClientBucket ? (
                      <StatusPill ok={hasExistingHouseholds(provider.existingClientBucket)}>
                        {EXISTING_CLIENT_LABELS[provider.existingClientBucket]}
                      </StatusPill>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px]" style={{ color: adminTheme.textSecondary }}>{provider.id}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusPill ok={provider.readinessSubmitted}>readiness</StatusPill>
                  <StatusPill ok={provider.application_status === "approved"}>approved</StatusPill>
                  <StatusPill ok={Boolean(provider.stripe_connect_ready)}>payout-ready</StatusPill>
                  <StatusPill ok={Boolean(provider.marketplace_access)}>marketplace</StatusPill>
                  <StatusPill ok={provider.hasNorthStar}>North Star</StatusPill>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                <Metric label="Invites" value={provider.invitesIssued} detail={`${provider.invitesAccepted} accepted`} />
                <Metric label="Relationships" value={provider.relationships} detail="provider-brought" />
                <Metric label="Paid bookings" value={provider.paidRelationshipBookings} detail={`${provider.completedRelationshipServices} completed together`} />
                <Metric label="Gross service" value={money(provider.grossRelationshipCents)} detail={`${money(provider.platformFeeCents)} platform fee`} />
                <Metric label="Network" value={provider.networkRelationships} detail="recorded relationships" />
                <Metric label="Contributions" value={provider.contributions} detail={`${provider.payoutReleasedCount} payouts released`} />
              </div>

              <p className="mt-3 text-[11px]" style={{ color: adminTheme.textSecondary }}>
                application: {provider.application_status ?? "not submitted"} · readiness: {provider.readiness_status ?? "not set"} · identity: {provider.identity_status ?? "not set"} · background: {provider.background_check_status ?? "not set"} · insurance: {provider.insurance_status ?? "not set"}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
