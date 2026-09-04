import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CustomerHouseholdMemorySuggestionsCard } from "../../components/relationship/CustomerHouseholdMemorySuggestionsCard";
import { MutualRescheduleCard } from "../../components/relationship/MutualRescheduleCard";
import { RelationshipAssignmentPendingCard } from "../../components/relationship/RelationshipAssignmentPendingCard";
import type { Booking } from "../../domain/booking";
import { supabase } from "../../lib/supabase";
import { CustomerBookingDetails } from "../../shell/screens/CustomerBookingDetails";

export function BookingDetails() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [confirmedForCurrentCustomer, setConfirmedForCurrentCustomer] = useState(false);
  const [reschedulableForCurrentCustomer, setReschedulableForCurrentCustomer] = useState(false);

  useEffect(() => {
    let active = true;
    if (!bookingId) {
      setConfirmedForCurrentCustomer(false);
      setReschedulableForCurrentCustomer(false);
      return () => { active = false; };
    }

    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) {
          if (active) {
            setConfirmedForCurrentCustomer(false);
            setReschedulableForCurrentCustomer(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("bookings")
          .select("status, customer_id, provider_id, scheduled_start")
          .eq("id", bookingId)
          .maybeSingle();

        if (!active) return;
        if (error || !data) {
          setConfirmedForCurrentCustomer(false);
          setReschedulableForCurrentCustomer(false);
          return;
        }

        const row = data as Pick<Booking, "status" | "customer_id" | "provider_id" | "scheduled_start">;
        const isCurrentCustomer = row.customer_id === user.id;
        setConfirmedForCurrentCustomer(row.status === "confirmed" && isCurrentCustomer);
        setReschedulableForCurrentCustomer(
          row.status === "accepted" &&
          isCurrentCustomer &&
          Boolean(row.provider_id) &&
          new Date(row.scheduled_start).getTime() > Date.now()
        );
      } catch {
        if (active) {
          setConfirmedForCurrentCustomer(false);
          setReschedulableForCurrentCustomer(false);
        }
      }
    })();

    return () => { active = false; };
  }, [bookingId]);

  return (
    <>
      <CustomerBookingDetails />
      {reschedulableForCurrentCustomer && bookingId ? (
        <MutualRescheduleCard bookingId={bookingId} audience="customer" />
      ) : null}
      {bookingId ? <RelationshipAssignmentPendingCard bookingId={bookingId} /> : null}
      {confirmedForCurrentCustomer && bookingId ? (
        <CustomerHouseholdMemorySuggestionsCard bookingId={bookingId} />
      ) : null}
    </>
  );
}
