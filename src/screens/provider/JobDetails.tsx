import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ProviderHouseholdMemorySuggestionCard } from "../../components/relationship/ProviderHouseholdMemorySuggestionCard";
import { ProviderTrustedCoverageCard } from "../../components/relationship/ProviderTrustedCoverageCard";
import { MutualRescheduleCard } from "../../components/relationship/MutualRescheduleCard";
import type { Booking } from "../../domain/booking";
import { getBooking } from "../../lib/bookingApi";
import JobDetailsScreen from "../../app/provider/screens/JobDetailsScreen";

export function JobDetails() {
  const { jobId } = useParams<{ jobId: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);

  async function refreshBooking() {
    if (!jobId) return;
    setBooking(await getBooking(jobId));
  }

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

  // Schedule negotiation and trusted coverage are both pre-service continuity tools.
  // Rescheduling keeps the same CSP relationship when timing can be resolved; coverage is
  // the next continuity option when it cannot. Neither path mutates an in-progress visit.
  const canMutuallyReschedule =
    Boolean(jobId) &&
    Boolean(booking?.provider_id) &&
    booking?.status === "accepted";

  const canRequestTrustedCoverage = canMutuallyReschedule;

  const canLeaveContinuity =
    Boolean(jobId) &&
    Boolean(booking?.provider_id) &&
    (booking?.status === "completed_by_provider" || booking?.status === "confirmed");

  return (
    <>
      <JobDetailsScreen key={`${jobId ?? "job"}:${booking?.updated_at ?? "initial"}`} />
      {jobId && (canMutuallyReschedule || canRequestTrustedCoverage || canLeaveContinuity) ? (
        <div className="pb-24">
          {canMutuallyReschedule ? (
            <MutualRescheduleCard
              bookingId={jobId}
              audience="provider"
              onScheduleChanged={refreshBooking}
            />
          ) : null}
          {canRequestTrustedCoverage ? <ProviderTrustedCoverageCard bookingId={jobId} /> : null}
          {canLeaveContinuity ? <ProviderHouseholdMemorySuggestionCard bookingId={jobId} /> : null}
        </div>
      ) : null}
    </>
  );
}
