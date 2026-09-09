import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useParams } from "react-router-dom";
import { CustomerCancellationCard } from "../../components/booking/CustomerCancellationCard";
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
  const [manageableForCurrentCustomer, setManageableForCurrentCustomer] = useState(false);

  useEffect(() => {
    let active = true;
    if (!bookingId) {
      setConfirmedForCurrentCustomer(false);
      setReschedulableForCurrentCustomer(false);
      setManageableForCurrentCustomer(false);
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
            setManageableForCurrentCustomer(false);
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
          setManageableForCurrentCustomer(false);
          return;
        }

        const row = data as Pick<Booking, "status" | "customer_id" | "provider_id" | "scheduled_start">;
        const isCurrentCustomer = row.customer_id === user.id;
        const visitIsFuture = new Date(row.scheduled_start).getTime() > Date.now();
        setConfirmedForCurrentCustomer(row.status === "confirmed" && isCurrentCustomer);
        setReschedulableForCurrentCustomer(row.status === "accepted" && isCurrentCustomer && Boolean(row.provider_id));
        setManageableForCurrentCustomer(
          isCurrentCustomer &&
          visitIsFuture &&
          ["created", "accepted"].includes(row.status)
        );
      } catch {
        if (active) {
          setConfirmedForCurrentCustomer(false);
          setReschedulableForCurrentCustomer(false);
          setManageableForCurrentCustomer(false);
        }
      }
    })();

    return () => { active = false; };
  }, [bookingId]);

  return (
    <>
      <CustomerBookingDetails />

      {manageableForCurrentCustomer && bookingId ? (
        <details className="mb-3 overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
          <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-left [&::-webkit-details-marker]:hidden">
            <div>
              <p className="text-sm font-semibold text-[#0B1220]">Manage visit</p>
              <p className="mt-0.5 text-xs text-[#667085]">
                {reschedulableForCurrentCustomer ? "Reschedule or cancel this visit." : "Review cancellation options."}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#98A2B3]" />
          </summary>
          <div className="border-t border-[#E4E7EC] px-4 py-4">
            {reschedulableForCurrentCustomer ? (
              <MutualRescheduleCard bookingId={bookingId} audience="customer" embedded />
            ) : null}
            <CustomerCancellationCard bookingId={bookingId} embedded />
          </div>
        </details>
      ) : null}

      {bookingId ? <RelationshipAssignmentPendingCard bookingId={bookingId} /> : null}
      {confirmedForCurrentCustomer && bookingId ? (
        <CustomerHouseholdMemorySuggestionsCard bookingId={bookingId} />
      ) : null}
    </>
  );
}
