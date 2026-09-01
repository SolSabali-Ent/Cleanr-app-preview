import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CustomerHouseholdMemorySuggestionsCard } from "../../components/relationship/CustomerHouseholdMemorySuggestionsCard";
import { RelationshipAssignmentPendingCard } from "../../components/relationship/RelationshipAssignmentPendingCard";
import type { Booking } from "../../domain/booking";
import { supabase } from "../../lib/supabase";
import { CustomerBookingDetails } from "../../shell/screens/CustomerBookingDetails";

export function BookingDetails() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [confirmedForCurrentCustomer, setConfirmedForCurrentCustomer] = useState(false);

  useEffect(() => {
    let active = true;
    if (!bookingId) {
      setConfirmedForCurrentCustomer(false);
      return () => { active = false; };
    }

    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) {
          if (active) setConfirmedForCurrentCustomer(false);
          return;
        }

        const { data, error } = await supabase
          .from("bookings")
          .select("status, customer_id")
          .eq("id", bookingId)
          .maybeSingle();

        if (!active) return;
        if (error || !data) {
          setConfirmedForCurrentCustomer(false);
          return;
        }

        const row = data as Pick<Booking, "status" | "customer_id">;
        setConfirmedForCurrentCustomer(row.status === "confirmed" && row.customer_id === user.id);
      } catch {
        if (active) setConfirmedForCurrentCustomer(false);
      }
    })();

    return () => { active = false; };
  }, [bookingId]);

  return (
    <>
      <CustomerBookingDetails />
      {bookingId ? <RelationshipAssignmentPendingCard bookingId={bookingId} /> : null}
      {confirmedForCurrentCustomer && bookingId ? (
        <CustomerHouseholdMemorySuggestionsCard bookingId={bookingId} />
      ) : null}
    </>
  );
}
