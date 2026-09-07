import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ProviderHouseholdMemorySuggestionCard } from "../../components/relationship/ProviderHouseholdMemorySuggestionCard";
import { ProviderTrustedCoverageCard } from "../../components/relationship/ProviderTrustedCoverageCard";
import { MutualRescheduleCard } from "../../components/relationship/MutualRescheduleCard";
import { AssignedCustomerProfileCard } from "../../components/profile/AssignedCustomerProfileCard";
import type { Booking } from "../../domain/booking";
import { getBooking } from "../../lib/bookingApi";
import JobDetailsScreen from "../../app/provider/screens/JobDetailsScreen";
import VisitEvidencePanel from "../../app/provider/components/VisitEvidencePanel";

const SERVICE_TIME_ZONE = "America/New_York";

function serviceDateKey(value: string, timeZone = SERVICE_TIME_ZONE): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

function isPastServiceDay(booking: Booking | null): boolean {
  if (!booking?.scheduled_start) return false;
  const scheduledDay = serviceDateKey(booking.scheduled_start);
  const today = serviceDateKey(new Date().toISOString());
  return Boolean(scheduledDay && today && scheduledDay < today);
}

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

  const pastServiceDay = useMemo(() => isPastServiceDay(booking), [booking]);

  // Internal names stay precise even when CSP-facing copy uses everyday language.
  const canMutuallyReschedule =
    Boolean(jobId) &&
    Boolean(booking?.provider_id) &&
    booking?.status === "accepted";

  const canRequestTrustedCoverage = canMutuallyReschedule && !pastServiceDay;

  const canLeaveContinuity =
    Boolean(jobId) &&
    Boolean(booking?.provider_id) &&
    (booking?.status === "completed_by_provider" || booking?.status === "confirmed");

  const canUseVisitEvidence =
    Boolean(jobId) &&
    Boolean(booking?.provider_id) &&
    !pastServiceDay &&
    (booking?.status === "accepted" || booking?.status === "in_progress");

  const evidenceUploadsClosed = Boolean(booking?.service_finished_at);

  return (
    <>
      {jobId && booking?.provider_id ? <AssignedCustomerProfileCard bookingId={jobId} /> : null}

      {pastServiceDay && booking?.status === "accepted" ? (
        <section className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-950/25 p-4 text-white">
          <p className="text-sm font-semibold text-amber-200">This visit date has passed</p>
          <p className="mt-1 text-xs leading-5 text-amber-100/80">
            Travel, arrival, and Start Job actions are closed for this visit. Use the reschedule option below if the household still needs service, or contact Cleanr support if the booking needs operational review.
          </p>
        </section>
      ) : null}

      <div className={`job-details-shell${pastServiceDay ? " past-service-day" : ""}`}>
        <JobDetailsScreen key={`${jobId ?? "job"}:${booking?.updated_at ?? "initial"}`} />
      </div>

      {/* Keep the old local-only photo inputs hidden so CSPs see only the saved-photo path below. */}
      <style>{`
        .job-details-shell details:has(input[type="file"]) { display: none; }
        .job-details-shell.past-service-day section:has(button) { display: none; }
      `}</style>

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
