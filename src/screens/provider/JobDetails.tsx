import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ProviderHouseholdMemorySuggestionCard } from "../../components/relationship/ProviderHouseholdMemorySuggestionCard";
import { ProviderTrustedCoverageCard } from "../../components/relationship/ProviderTrustedCoverageCard";
import { MutualRescheduleCard } from "../../components/relationship/MutualRescheduleCard";
import type { Booking } from "../../domain/booking";
import { getBooking } from "../../lib/bookingApi";
import JobDetailsScreen from "../../app/provider/screens/JobDetailsScreen";
import VisitEvidencePanel from "../../app/provider/components/VisitEvidencePanel";

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

  // Internal names stay precise even when CSP-facing copy uses everyday language.
  const canMutuallyReschedule =
    Boolean(jobId) &&
    Boolean(booking?.provider_id) &&
    booking?.status === "accepted";

  const canRequestTrustedCoverage = canMutuallyReschedule;

  const canLeaveContinuity =
    Boolean(jobId) &&
    Boolean(booking?.provider_id) &&
    (booking?.status === "completed_by_provider" || booking?.status === "confirmed");

  const canUseVisitEvidence =
    Boolean(jobId) &&
    Boolean(booking?.provider_id) &&
    (booking?.status === "accepted" || booking?.status === "in_progress");

  const evidenceUploadsClosed = Boolean(booking?.service_finished_at);

  return (
    <>
      <div className="job-details-shell">
        <JobDetailsScreen key={`${jobId ?? "job"}:${booking?.updated_at ?? "initial"}`} />
      </div>

      {/* Keep the old local-only photo inputs hidden so CSPs see only the saved-photo path below. */}
      <style>{`.job-details-shell details:has(input[type="file"]) { display: none; }`}</style>

      {jobId && canUseVisitEvidence ? (
        <section className="space-y-3 pb-6">
          <div className="px-1">
            <p className="text-xs font-semibold text-slate-300">Photos for this visit</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-500">
              Optional and private by default. Add photos only when there is something useful to show.
            </p>
          </div>
          <VisitEvidencePanel
            bookingId={jobId}
            kind="before"
            disabled={evidenceUploadsClosed}
          />
          {booking?.status === "in_progress" ? (
            <VisitEvidencePanel
              bookingId={jobId}
              kind="after"
              disabled={evidenceUploadsClosed}
            />
          ) : null}
        </section>
      ) : null}

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
