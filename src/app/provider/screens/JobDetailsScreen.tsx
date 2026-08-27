import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getBooking, acceptBookingAsProvider, startBookingAsProvider, completeBookingAsProvider } from "../../../lib/bookingApi";
import type { Booking } from "../../../domain/booking";
import type { HouseholdContext } from "../../../domain/householdContext";
import type { ProviderHouseholdRelationshipSummary } from "../../../domain/serviceRelationship";
import { getHouseholdContextForBooking } from "../../../lib/householdContextApi";
import { getMyHouseholdContinuityForCustomer } from "../../../lib/serviceRelationshipApi";
import { isProviderAvailable } from "../../../api/providerAvailability";
import { supabase } from "../../../lib/supabase";
import { checklistTemplates } from "../data/checklistTemplates";
import JobStatusStepper from "../components/JobStatusStepper";
import { useJobFlow } from "../logic/useJobFlow";
import { useUnreadBookingMessageIds } from "../../../hooks/useUnreadBookingMessageIds";
import { isProviderCustomerMessagingOpen } from "../../../lib/providerCustomerMessaging";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function relationshipHeading(continuity: ProviderHouseholdRelationshipSummary): string {
  if (continuity.relationship?.customerPreferred) return "A household that prefers working with you";
  if (continuity.completedServicesCount >= 2) return "A household you know";
  if (continuity.completedServicesCount === 1) return "A returning household";
  return "A new household relationship";
}

export default function JobDetailsScreen() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [householdContext, setHouseholdContext] = useState<HouseholdContext | null>(null);
  const [householdContinuity, setHouseholdContinuity] = useState<ProviderHouseholdRelationshipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [availabilityHint, setAvailabilityHint] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const { unreadBookingIds, refetch: refetchUnread } = useUnreadBookingMessageIds();

  const checklist = checklistTemplates.default;

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    getBooking(jobId)
      .then(setBooking)
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    let mounted = true;
    async function loadProviderId() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      setProviderId(user?.id ?? null);
    }
    void loadProviderId();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadHouseholdMemory() {
      setHouseholdContext(null);
      if (!booking?.id || !booking.provider_id || !providerId) return;
      if (booking.provider_id !== providerId) return;

      try {
        const context = await getHouseholdContextForBooking(booking.id);
        if (mounted) setHouseholdContext(context);
      } catch {
        // Household memory is optional and migration-gated. A missing/inaccessible context
        // must never interrupt the operational job flow.
        if (mounted) setHouseholdContext(null);
      }
    }

    void loadHouseholdMemory();
    return () => {
      mounted = false;
    };
  }, [booking?.id, booking?.provider_id, providerId]);

  useEffect(() => {
    let mounted = true;

    async function loadHouseholdContinuity() {
      setHouseholdContinuity(null);
      if (!booking?.customer_id || !booking.provider_id || !providerId) return;
      if (booking.provider_id !== providerId) return;

      try {
        const continuity = await getMyHouseholdContinuityForCustomer(booking.customer_id);
        if (mounted) setHouseholdContinuity(continuity);
      } catch {
        // Relationship context is additive. Booking execution must remain available even if
        // continuity cannot be resolved yet.
        if (mounted) setHouseholdContinuity(null);
      }
    }

    void loadHouseholdContinuity();
    return () => {
      mounted = false;
    };
  }, [booking?.customer_id, booking?.provider_id, providerId]);

  useEffect(() => {
    let mounted = true;
    async function loadAvailabilityHint() {
      if (!providerId || !booking || booking.status !== "created") {
        setAvailabilityHint(null);
        return;
      }

      const startISO = booking.scheduled_start;
      const endISO =
        booking.scheduled_end ??
        new Date(new Date(booking.scheduled_start).getTime() + 2 * 60 * 60 * 1000).toISOString();

      try {
        const available = await isProviderAvailable(providerId, startISO, endISO);
        if (!mounted) return;
        setAvailabilityHint(
          available ? null : "This job overlaps your blocked time or existing schedule."
        );
      } catch {
        if (!mounted) return;
        setAvailabilityHint(null);
      }
    }

    void loadAvailabilityHint();
    return () => {
      mounted = false;
    };
  }, [providerId, booking]);

  const statusMap: Record<string, string> = {
    created: "en_route",
    accepted: "en_route",
    in_progress: "in_progress",
    completed_by_provider: "completed",
    confirmed: "completed",
  };
  const jobStatus = booking ? (statusMap[booking.status] || "en_route") : "en_route";
  const { isComplete } = useJobFlow(jobStatus);

  const handleCheck = (item: string) => {
    setCheckedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleAccept = async () => {
    if (!jobId) return;
    setActionError(null);
    try {
      const b = await acceptBookingAsProvider(jobId);
      setBooking(b);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not accept job. You may not have permission.");
    }
  };

  const handleStart = async () => {
    if (!jobId) return;
    setActionError(null);
    try {
      const b = await startBookingAsProvider(jobId);
      setBooking(b);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not start job.");
    }
  };

  const handleComplete = async () => {
    if (!jobId || !booking) return;
    if (checkedItems.length !== checklist.length) {
      alert("Please complete all checklist items.");
      return;
    }
    setActionError(null);
    try {
      const b = await completeBookingAsProvider(jobId);
      setBooking(b);
      navigate("/csp/dashboard/jobs");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not complete job.");
    }
  };

  if (loading) {
    return (
      <div className="text-white p-4 flex items-center justify-center min-h-[40vh]">
        <p className="text-sm text-slate-400">Loading job…</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-white p-4">
        <p className="text-sm text-slate-400">Job not found.</p>
        <button onClick={() => navigate(-1)} className="text-xs text-slate-500 underline mt-2">
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="text-white pb-24 relative min-h-[60vh]">
      <img
        src="/cleanr_final-04.png"
        alt=""
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ zIndex: 1, width: "360px", opacity: 0.08 }}
      />
      <div className="relative z-10">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-xs text-slate-400 mb-3"
        >
          ← Back
        </button>

        <h1 className="text-xl font-semibold mb-2">Job Details</h1>
        <p className="text-xs text-slate-400 mb-4">Booking ID: {booking.id}</p>

        <div className="mb-4">
          <JobStatusStepper currentStatus={jobStatus} />
        </div>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
          <p className="text-xs font-semibold text-slate-500 mb-1">Address</p>
          <p className="text-sm font-semibold text-slate-900">{booking.address}</p>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
          <p className="text-xs font-semibold text-slate-500 mb-1">When</p>
          <p className="text-sm text-slate-900">
            {formatDate(booking.scheduled_start)} at {formatTime(booking.scheduled_start)}
          </p>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
          <p className="text-xs font-semibold text-slate-500 mb-1">Payout</p>
          <p className="text-sm font-semibold text-slate-900">
            ${((booking.price_cents ?? 0) / 100).toFixed(0)}
          </p>
        </section>

        {householdContinuity ? (
          <section className="bg-sky-50 border border-sky-200 rounded-2xl p-4 mb-3 shadow-md">
            <p className="text-xs font-semibold text-sky-900">Relationship continuity</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{relationshipHeading(householdContinuity)}</p>
            {householdContinuity.completedServicesCount > 0 ? (
              <p className="mt-1 text-xs leading-5 text-slate-600">
                You have completed {householdContinuity.completedServicesCount} prior service{householdContinuity.completedServicesCount === 1 ? "" : "s"} with this household{householdContinuity.lastServedAt ? ` · last visit ${formatDate(householdContinuity.lastServedAt)}` : ""}.
              </p>
            ) : (
              <p className="mt-1 text-xs leading-5 text-slate-600">
                This is the beginning of the relationship. Learn the household, communicate clearly, and leave useful continuity for the next visit.
              </p>
            )}
            <p className="mt-2 text-[11px] leading-4 text-sky-800">
              The booking is today&apos;s transaction. The relationship is what can compound across visits.
            </p>
          </section>
        ) : null}

        {householdContext?.memoryEnabled ? (
          <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-3 shadow-md">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-xs font-semibold text-emerald-800">Household memory</p>
                <p className="text-[11px] text-emerald-700 mt-1">Reusable preferences this household chose to remember with Cleanr.</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800">Consented</span>
            </div>
            <dl className="space-y-2 text-sm text-slate-900">
              {householdContext.servicePreferences ? <div><dt className="text-xs text-slate-500">Service preferences</dt><dd className="whitespace-pre-wrap">{householdContext.servicePreferences}</dd></div> : null}
              {householdContext.petContext ? <div><dt className="text-xs text-slate-500">Pets</dt><dd className="whitespace-pre-wrap">{householdContext.petContext}</dd></div> : null}
              {householdContext.surfacesToAvoid ? <div><dt className="text-xs text-slate-500">Surfaces / items to avoid</dt><dd className="whitespace-pre-wrap">{householdContext.surfacesToAvoid}</dd></div> : null}
              {householdContext.communicationPreferences ? <div><dt className="text-xs text-slate-500">Communication</dt><dd className="whitespace-pre-wrap">{householdContext.communicationPreferences}</dd></div> : null}
            </dl>
            <p className="mt-3 text-[10px] leading-4 text-emerald-700">Access codes and one-visit entry instructions are never stored here. Check this visit&apos;s details below for anything time-specific.</p>
          </section>
        ) : null}

        {(booking.access_notes ||
          booking.gate_code ||
          booking.parking_notes ||
          booking.entry_instructions ||
          booking.pet_notes ||
          booking.surfaces_to_avoid) && (
          <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
            <p className="text-xs font-semibold text-slate-500 mb-1">This visit</p>
            <p className="text-[11px] text-slate-500 mb-2">Current booking details from the customer. These can differ from remembered household preferences.</p>
            <dl className="space-y-2 text-sm text-slate-900">
              {booking.access_notes ? <div><dt className="text-xs text-slate-500">Access notes</dt><dd className="whitespace-pre-wrap">{booking.access_notes}</dd></div> : null}
              {booking.gate_code ? <div><dt className="text-xs text-slate-500">Gate / door code</dt><dd>{booking.gate_code}</dd></div> : null}
              {booking.parking_notes ? <div><dt className="text-xs text-slate-500">Parking</dt><dd className="whitespace-pre-wrap">{booking.parking_notes}</dd></div> : null}
              {booking.entry_instructions ? <div><dt className="text-xs text-slate-500">Entry</dt><dd className="whitespace-pre-wrap">{booking.entry_instructions}</dd></div> : null}
              {booking.pet_notes ? <div><dt className="text-xs text-slate-500">Pets</dt><dd className="whitespace-pre-wrap">{booking.pet_notes}</dd></div> : null}
              {booking.surfaces_to_avoid ? <div><dt className="text-xs text-slate-500">Surfaces to avoid</dt><dd className="whitespace-pre-wrap">{booking.surfaces_to_avoid}</dd></div> : null}
            </dl>
            {booking.customer_access_updated_at ? (
              <p className="text-[10px] text-slate-400 mt-2">Customer last updated {new Date(booking.customer_access_updated_at).toLocaleString()}</p>
            ) : null}
          </section>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
          <p className="text-xs font-semibold text-slate-500 mb-2">Checklist</p>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <input type="checkbox" checked={checkedItems.includes(item)} onChange={() => handleCheck(item)} className="w-4 h-4" />
                <label className={`text-sm ${checkedItems.includes(item) ? "line-through text-slate-400" : "text-slate-900"}`}>{item}</label>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
          <p className="text-xs font-semibold text-slate-500 mb-2">Upload Before Photos</p>
          <input type="file" multiple className="w-full text-xs" />
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
          <p className="text-xs font-semibold text-slate-500 mb-2">Upload After Photos</p>
          <input type="file" multiple className="w-full text-xs" />
        </section>

        {actionError && <p className="text-sm text-red-400 mb-3">{actionError}</p>}
        {availabilityHint && booking.status === "created" && <p className="text-sm text-amber-300 mb-3">{availabilityHint}</p>}

        <div className="space-y-3 mt-4">
          {booking.status === "created" && <button onClick={handleAccept} className="w-full bg-[#0A84FF] text-white py-3 rounded-xl text-sm font-semibold shadow-md shadow-[#0A84FF]/40">Accept Job</button>}
          {booking.status === "accepted" && <button onClick={handleStart} className="w-full bg-[#0A84FF] text-white py-3 rounded-xl text-sm font-semibold shadow-md shadow-[#0A84FF]/40">Start Job</button>}

          {isProviderCustomerMessagingOpen(booking.status) ? (
            <button type="button" onClick={() => { refetchUnread(); navigate(`/csp/dashboard/jobs/${jobId}/message`); }} className="w-full bg-white border border-slate-200 py-3 rounded-xl text-sm font-semibold text-slate-900 shadow-md relative">
              Message customer
              {booking && unreadBookingIds.has(booking.id) ? <span className="absolute top-1/2 right-4 -translate-y-1/2 w-2 h-2 rounded-full bg-[#0A84FF]" aria-hidden /> : null}
            </button>
          ) : null}

          <button onClick={() => navigate(`/csp/dashboard/jobs/${jobId}/incident`)} className="w-full bg-white border border-slate-200 py-3 rounded-xl text-sm font-semibold text-slate-900 shadow-md">Report Incident</button>
          <button onClick={() => navigate(`/csp/dashboard/jobs/${jobId}/ai-check`)} className="w-full bg-white border border-slate-200 py-3 rounded-xl text-sm font-semibold text-slate-900 shadow-md">Run AI Check</button>
          {booking.status === "in_progress" && !isComplete && <button onClick={handleComplete} className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold shadow-md">Mark Job Complete</button>}
        </div>
      </div>
    </div>
  );
}
