import { useEffect, useState } from "react";
import { CheckCircle2, Clock3 } from "lucide-react";
import { supabase } from "../../lib/supabase";

type PendingRelationshipState = {
  pending: boolean;
  providerName: string | null;
  relationshipOrigin: string | null;
};

export function RelationshipAssignmentPendingCard({ bookingId }: { bookingId: string }) {
  const [state, setState] = useState<PendingRelationshipState>({
    pending: false,
    providerName: null,
    relationshipOrigin: null,
  });

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) return;

        const { data: booking, error: bookingError } = await supabase
          .from("bookings")
          .select("customer_id,provider_id,status,stripe_payment_intent_id,service_relationship_id")
          .eq("id", bookingId)
          .maybeSingle();

        if (!active || bookingError || !booking || booking.customer_id !== user.id) return;

        const relationshipId =
          typeof booking.service_relationship_id === "string" && booking.service_relationship_id.trim()
            ? booking.service_relationship_id
            : null;
        const pending =
          Boolean(booking.stripe_payment_intent_id) &&
          Boolean(relationshipId) &&
          !booking.provider_id &&
          booking.status === "created";

        if (!pending || !relationshipId) {
          setState({ pending: false, providerName: null, relationshipOrigin: null });
          return;
        }

        const { data: relationship, error: relationshipError } = await supabase
          .from("service_relationships")
          .select("customer_id,provider_id,origin,status")
          .eq("id", relationshipId)
          .maybeSingle();

        if (
          !active ||
          relationshipError ||
          !relationship ||
          relationship.customer_id !== user.id ||
          !["active", "paused"].includes(String(relationship.status ?? ""))
        ) {
          setState({ pending: false, providerName: null, relationshipOrigin: null });
          return;
        }

        const providerId =
          typeof relationship.provider_id === "string" ? relationship.provider_id : null;
        let providerName: string | null = null;

        if (providerId) {
          const { data: provider } = await supabase
            .from("provider_public_profiles")
            .select("full_name")
            .eq("id", providerId)
            .maybeSingle();
          providerName = provider?.full_name ?? null;
        }

        if (!active) return;
        setState({
          pending: true,
          providerName,
          relationshipOrigin:
            typeof relationship.origin === "string" ? relationship.origin : null,
        });
      } catch {
        if (active) setState({ pending: false, providerName: null, relationshipOrigin: null });
      }
    })();

    return () => {
      active = false;
    };
  }, [bookingId]);

  if (!state.pending) return null;

  const existingRelationship = state.relationshipOrigin === "provider_brought";

  return (
    <section className="provider-card p-4 mb-3 border border-[#D9EFD0] bg-[#F8FCF6]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-[#EAF6E4] p-2 text-[#5B8F3B]">
          <Clock3 className="h-4 w-4" />
        </div>
        <div>
          <p className="section-label mb-1">Relationship continuity</p>
          <p className="text-sm font-semibold text-[#0B1220]">
            {state.providerName
              ? `We’re confirming ${state.providerName} for this visit.`
              : "We’re confirming your existing CSP for this visit."}
          </p>
          <p className="mt-1 text-sm leading-6 text-[#667085]">
            Your payment and relationship are recorded. Formal service assignment is still being reconciled through Cleanr’s fulfillment infrastructure, so we are not showing a different provider or pretending the assignment is complete before it is durable.
          </p>
          {existingRelationship ? (
            <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-[#4B6840]">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Cleanr recognizes that this relationship existed before the platform. This handoff does not convert it into generic marketplace demand.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
