import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  findAvailableJobsForProvider,
  listMyJobsAsProvider,
  type AvailableJob,
} from "../../../lib/bookingApi";
import { useProfile } from "../../../lib/useProfile";
import type { Booking } from "../../../domain/booking";
import {
  CSP_SURFACE,
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";
import { useUnreadBookingMessageIds } from "../../../hooks/useUnreadBookingMessageIds";

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

function formatDistance(meters: number | undefined): string {
  if (meters == null) return "—";
  const miles = meters / 1609.34;
  if (miles < 0.1) return "< 0.1 mi";
  return `${miles.toFixed(1)} mi`;
}

type Tab = "available" | "active" | "completed";

function JobCardAvailable({
  job,
  onAccept,
}: {
  job: AvailableJob;
  onAccept: (id: string) => void;
}) {
  return (
    <div
      className="rounded-2xl border w-full text-left overflow-hidden"
      style={{
        backgroundColor: CSP_SURFACE,
        borderColor: "rgba(248, 250, 252, 0.08)",
      }}
    >
      <div style={{ padding: CSP_CARD_PADDING }}>
        <p className="font-semibold" style={{ color: CSP_TEXT_PRIMARY }}>
          {formatDistance(job.distance_meters)}
        </p>
        <p
          className="text-sm mt-1"
          style={{ color: CSP_TEXT_SECONDARY }}
        >
          {formatTime(job.scheduled_start)} · {formatDate(job.scheduled_start)}
        </p>
        <p
          className="text-sm mt-0.5"
          style={{ color: CSP_TEXT_SECONDARY }}
        >
          ${((job.price_cents ?? 0) / 100).toFixed(0)}
        </p>
        <p
          className="text-xs mt-0.5 truncate"
          style={{ color: CSP_TEXT_SECONDARY }}
        >
          {job.address}
        </p>
        <button
          type="button"
          onClick={() => onAccept(job.id)}
          className="mt-3 w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-85 disabled:opacity-50"
          style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}

function JobCardMy({
  booking,
  hasUnreadMessages,
}: {
  booking: Booking;
  hasUnreadMessages: boolean;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/csp/dashboard/jobs/${booking.id}`)}
      className="w-full text-left rounded-2xl border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F1A] relative"
      style={{
        backgroundColor: CSP_SURFACE,
        padding: CSP_CARD_PADDING,
        borderColor: "rgba(248, 250, 252, 0.08)",
      }}
    >
      {hasUnreadMessages ? (
        <span
          className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#0A84FF]"
          aria-hidden
        />
      ) : null}
      <p className="font-semibold" style={{ color: CSP_TEXT_PRIMARY }}>
        {booking.address}
      </p>
      <p
        className="text-sm mt-1"
        style={{ color: CSP_TEXT_SECONDARY }}
      >
        {formatTime(booking.scheduled_start)} · {formatDate(booking.scheduled_start)}
      </p>
      <p
        className="text-sm mt-0.5"
        style={{ color: CSP_TEXT_SECONDARY }}
      >
        ${((booking.price_cents ?? 0) / 100).toFixed(0)}
      </p>
      <span
        className="inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium capitalize"
        style={{
          backgroundColor: "rgba(248, 250, 252, 0.1)",
          color: CSP_TEXT_SECONDARY,
        }}
      >
        {booking.status.replace("_", " ")}
      </span>
    </button>
  );
}

export default function JobsScreen() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { unreadBookingIds } = useUnreadBookingMessageIds();
  const [tab, setTab] = useState<Tab>("available");
  const [available, setAvailable] = useState<AvailableJob[]>([]);
  const [myJobs, setMyJobs] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const providerId = profile?.role === "csp" ? profile.id : null;
    if (!providerId) {
      setAvailable([]);
      setMyJobs([]);
      setLoading(false);
      return;
    }
    if (!profile?.marketplace_access) {
      setAvailable([]);
      listMyJobsAsProvider()
        .then((my) => setMyJobs(my))
        .catch(() => setMyJobs([]))
        .finally(() => setLoading(false));
      return;
    }
    Promise.all([
      findAvailableJobsForProvider(providerId, 100),
      listMyJobsAsProvider(),
    ])
      .then(([av, my]) => {
        setAvailable(av);
        setMyJobs(my);
      })
      .catch((err) => {
        setError(err?.message ?? "Failed to load jobs");
      })
      .finally(() => setLoading(false));
  }, [profile?.id, profile?.role, profile?.marketplace_access]);

  const active = myJobs.filter(
    (b) => b.status === "accepted" || b.status === "in_progress"
  );
  const completed = myJobs.filter(
    (b) => b.status === "completed_by_provider" || b.status === "confirmed"
  );

  const handleAccept = (jobId: string) => {
    navigate(`/csp/dashboard/jobs/${jobId}`);
  };

  if (loading) {
    return (
      <div
        className="min-h-[40vh] flex items-center justify-center"
        style={{ color: CSP_TEXT_SECONDARY }}
      >
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[40vh] flex flex-col justify-center">
        <p className="text-sm" style={{ color: CSP_TEXT_SECONDARY }}>
          Unable to load jobs. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="relative" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Available</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Based on your service area.
        </p>
      </header>

      {/* Tabs */}
      <div
        className="flex rounded-xl border p-0.5 mb-6"
        style={{
          backgroundColor: CSP_SURFACE,
          borderColor: "rgba(248, 250, 252, 0.08)",
        }}
      >
        {(
          [
            { key: "available" as Tab, label: "Available" },
            { key: "active" as Tab, label: "Active" },
            { key: "completed" as Tab, label: "Completed" },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              backgroundColor: tab === key ? "rgba(248, 250, 252, 0.1)" : "transparent",
              color: tab === key ? CSP_TEXT_PRIMARY : CSP_TEXT_SECONDARY,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "available" && (
        <section style={{ marginBottom: CSP_SECTION_GAP }}>
          {available.length === 0 ? (
            <div
              className="rounded-2xl border py-8 px-4 text-center text-sm"
              style={{
                backgroundColor: CSP_SURFACE,
                borderColor: "rgba(248, 250, 252, 0.08)",
                color: CSP_TEXT_SECONDARY,
              }}
            >
              <p>No jobs available.</p>
              <p className="mt-2">
                New jobs will appear when they fall within your service area.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {available.map((b) => (
                <JobCardAvailable
                  key={b.id}
                  job={b}
                  onAccept={handleAccept}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "active" && (
        <section style={{ marginBottom: CSP_SECTION_GAP }}>
          {active.length === 0 ? (
            <div
              className="rounded-2xl border py-6 text-center text-sm"
              style={{
                backgroundColor: CSP_SURFACE,
                borderColor: "rgba(248, 250, 252, 0.08)",
                color: CSP_TEXT_SECONDARY,
              }}
            >
              No active jobs.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {active.map((b) => (
                <JobCardMy key={b.id} booking={b} hasUnreadMessages={unreadBookingIds.has(b.id)} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "completed" && (
        <section style={{ marginBottom: CSP_SECTION_GAP }}>
          {completed.length === 0 ? (
            <div
              className="rounded-2xl border py-6 text-center text-sm"
              style={{
                backgroundColor: CSP_SURFACE,
                borderColor: "rgba(248, 250, 252, 0.08)",
                color: CSP_TEXT_SECONDARY,
              }}
            >
              No completed jobs.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {completed.map((b) => (
                <JobCardMy key={b.id} booking={b} hasUnreadMessages={unreadBookingIds.has(b.id)} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
