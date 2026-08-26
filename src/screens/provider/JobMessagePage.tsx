import { useEffect, useState, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBooking } from "../../lib/bookingApi";
import { isProviderCustomerMessagingOpen } from "../../lib/providerCustomerMessaging";
import { BookingMessageScreen } from "../shared/BookingMessageScreen";

function jobBackPath(jobId: string) {
  return `/csp/dashboard/jobs/${jobId}`;
}

export function JobMessagePage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  /** `undefined` = still loading booking row */
  const [bookingStatus, setBookingStatus] = useState<string | null | undefined>(undefined);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setBookingStatus(undefined);
      setNotFound(false);
      return;
    }
    let mounted = true;
    getBooking(jobId)
      .then((b) => {
        if (!mounted) return;
        if (!b) {
          setNotFound(true);
          setBookingStatus(null);
          return;
        }
        setNotFound(false);
        setBookingStatus(b.status);
      })
      .catch(() => {
        if (!mounted) return;
        setNotFound(true);
        setBookingStatus(null);
      });
    return () => {
      mounted = false;
    };
  }, [jobId]);

  const backPath = jobId ? jobBackPath(jobId) : "/csp/dashboard/jobs";

  const shell = (body: ReactNode) => (
    <div className="text-white p-4 min-h-[50vh]" style={{ backgroundColor: "#0f172a" }}>
      {body}
    </div>
  );

  if (!jobId) {
    return shell(
      <>
        <button type="button" onClick={() => navigate("/csp/dashboard/jobs")} className="text-sm underline">
          Back to jobs
        </button>
        <p className="mt-2 text-sm opacity-80">Job not found.</p>
      </>
    );
  }

  if (bookingStatus === undefined && !notFound) {
    return shell(
      <>
        <button type="button" onClick={() => navigate(backPath)} className="text-sm underline">
          Back to job
        </button>
        <p className="mt-4 text-sm opacity-80">Loading…</p>
      </>
    );
  }

  if (notFound || bookingStatus === null) {
    return shell(
      <>
        <button type="button" onClick={() => navigate(backPath)} className="text-sm underline">
          Back to job
        </button>
        <p className="mt-2 text-sm opacity-80">Could not load this job.</p>
      </>
    );
  }

  if (!isProviderCustomerMessagingOpen(bookingStatus)) {
    return shell(
      <>
        <button type="button" onClick={() => navigate(backPath)} className="text-sm underline">
          ← Back to job
        </button>
        <p className="mt-4 text-sm opacity-90">Messaging is closed for this completed job.</p>
        <p className="mt-2 text-sm opacity-80">For post-service issues, use support or dispute options.</p>
      </>
    );
  }

  return (
    <BookingMessageScreen
      variant="csp"
      backPath={backPath}
      backLabel="Back to job"
      title="Message customer"
      theme="dark"
    />
  );
}
