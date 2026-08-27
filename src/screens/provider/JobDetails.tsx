import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import JobDetailsScreen from "../../app/provider/screens/JobDetailsScreen";
import { ProviderHouseholdMemorySuggestionCard } from "../../components/relationship/ProviderHouseholdMemorySuggestionCard";
import { ProviderTrustedCoverageCard } from "../../components/relationship/ProviderTrustedCoverageCard";
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

  // Trusted coverage is a pre-service continuity mechanism. Once a visit is in progress,
  // the residential service engine owns fulfillment and the assigned provider cannot be swapped
  // through the relationship layer.
  const canRequestTrustedCoverage =
    Boolean(jobId) &&
    Boolean(booking?.provider_id) &&
    booking?.status === "accepted";

  const canLeaveContinuity =
    Boolean(jobId) &&
    Boolean(booking?.provider_id) &&
    (booking?.status === "completed_by_provider" || booking?.status === "confirmed");

  return (
    <>
      <JobDetailsScreen />
      {jobId && (canRequestTrustedCoverage || canLeaveContinuity) ? (
        <div className="pb-24">
          {canRequestTrustedCoverage ? <ProviderTrustedCoverageCard bookingId={jobId} /> : null}
          {canLeaveContinuity ? <ProviderHouseholdMemorySuggestionCard bookingId={jobId} /> : null}
        </div>
      ) : null}
    </>
  );
}
