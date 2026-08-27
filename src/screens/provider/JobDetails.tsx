import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import JobDetailsScreen from "../../app/provider/screens/JobDetailsScreen";
import { ProviderHouseholdMemorySuggestionCard } from "../../components/relationship/ProviderHouseholdMemorySuggestionCard";
import type { Booking } from "../../domain/booking";
import { getBooking } from "../../lib/bookingApi";

export function JobDetails() {
  const { jobId } = useParams<{ jobId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    let active = true;
    if (!jobId) {
      setBooking(null);
      return () => { active = false; };
    }

    void getBooking(jobId)
      .then((next) => {
        if (active) setBooking(next);
      })
      .catch(() => {
        if (active) setBooking(null);
      });

    return () => { active = false; };
  }, [jobId]);

  const canLeaveContinuity =
    Boolean(jobId) &&
    Boolean(booking?.provider_id) &&
    (booking?.status === "completed_by_provider" || booking?.status === "confirmed");

  return (
    <>
      <JobDetailsScreen />
      {canLeaveContinuity && jobId ? (
        <div className="pb-24">
          <ProviderHouseholdMemorySuggestionCard bookingId={jobId} />
        </div>
      ) : null}
    </>
  );
}
