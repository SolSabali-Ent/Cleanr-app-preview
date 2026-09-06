import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Camera, Check, ChevronDown } from "lucide-react";
import {
  getBooking,
  acceptBookingAsProvider,
  checkInBookingAsProvider,
  checkOutBookingAsProvider,
} from "../../../lib/bookingApi";
import type { Booking } from "../../../domain/booking";
import type { HouseholdContext } from "../../../domain/householdContext";
import type { ProviderHouseholdRelationshipSummary } from "../../../domain/serviceRelationship";
import { buildCleanrMethodVisitPractices } from "../../../domain/cleanrMethod";
import { householdContextHasUsefulMemory } from "../../../domain/householdContext";
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

function formatServiceAddress(address: string): string {
  const uppercaseTokens = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "GA"]);
  const titleTokens = new Set(["RD", "ST", "AVE", "DR", "LN", "BLVD", "CT", "PL", "PKWY", "CIR", "TER", "WAY", "HWY"]);

  return address
    .split(",")
    .map((segment) =>
      segment
        .trim()
        .split(/\s+/)
        .map((word) => {
          if (/^\d+(?:-\d+)?$/.test(word)) return word;
          const upper = word.toUpperCase();
          if (uppercaseTokens.has(upper)) return upper;
          if (titleTokens.has(upper)) return upper.charAt(0) + upper.slice(1).toLowerCase();
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ")
    )
    .join(", ");
}

function relationshipHeading(continuity: ProviderHouseholdRelationshipSummary): string {
  if (continuity.relationship?.customerPreferred) return "A household that prefers working with you";
  if (continuity.completedServicesCount >= 2) return "A household you know";
  if (continuity.completedServicesCount === 1) return "A returning household";
  return "A new household relationship";
}

function getLivePosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("location_unavailable"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("location_permission_denied"));
          return;
        }
        if (error.code === error.TIMEOUT) {
          reject(new Error("location_timeout"));
          return;
        }
        reject(new Error("location_unavailable"));
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  });
}

function visitLocationErrorMessage(error: unknown, action: "start" | "complete"): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("provider_too_far_for_check_in")) {
    return "You need to be at the service address to start this job.";
  }
  if (message.includes("provider_too_far_for_check_out")) {
    return "You need to be at the service address to complete this job.";
  }
  if (message.includes("location_permission_denied")) {
    return "Location access is required to verify that you are at the service address. Allow location access and try again.";
  }
  if (message.includes("location_timeout")) {
    return "We couldn't verify your location in time. Make sure location services are on and try again.";
  }
  if (message.includes("location_unavailable")) {
    return "We couldn't access your current location. Turn on location services and try again.";
  }
  if (message.includes("verified_service_address_required")) {
    return "This visit is missing a verified service address. Contact Cleanr support before continuing.";
  }
  if (message.includes("missing_booking_geo_location") || message.includes("missing_geo_location")) {
    return "Cleanr could not verify the service location for this visit. Contact support before continuing.";
  }
  return action === "start" ? "Could not start job. Try again." : "Could not complete job. Try again.";
}

export default function JobDetailsScreen() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [platformFeeCents, setPlatformFeeCents] = useState<number | null>(null);
  const [householdContext, setHouseholdContext] = useState<HouseholdContext | null>(null);
  const [householdContinuity, setHouseholdContinuity] = useState<ProviderHouseholdRelationshipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [locationChecking, setLocationChecking] = useState(false);
  const [availabilityHint, setAvailabilityHint] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [beforePhotoNames, setBeforePhotoNames] = useState<string[]>([]);
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
    async function loadFinancialTruth() {
      setPlatformFeeCents(null);
      if (!booking?.id || !providerId || booking.provider_id !== providerId) return;
      const { data, error } = await supabase
        .from("bookings")
        .select("platform_fee_cents")
        .eq("id", booking.id)
        .eq("provider_id", providerId)
        .maybeSingle();
      if (!mounted || error) return;
      setPlatformFeeCents(data?.platform_fee_cents == null ? 0 : Number(data.platform_fee_cents));
    }
    void loadFinancialTruth();
    return () => {
      mounted = false;
    };
  }, [booking?.id, booking?.provider_id, providerId]);

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
        setAvailabilityHint(available ? null : "This job overlaps your blocked time or existing schedule.");
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
    created: "scheduled",
    accepted: "scheduled",
    in_progress: "in_progress",
    completed_by_provider: "completed",
    confirmed: "completed",
  };
  const jobStatus = booking ? (statusMap[booking.status] || "scheduled") : "scheduled";
  const { isComplete } = useJobFlow(jobStatus);

  const methodPractices = useMemo(() => {
    if (!booking) return [];
    const hasVisitSpecificUpdates = Boolean(
      booking.access_notes ||
      booking.gate_code ||
      booking.parking_notes ||
      booking.entry_instructions ||
      booking.pet_notes ||
      booking.surfaces_to_avoid
    );
    return buildCleanrMethodVisitPractices({
      completedServicesCount: householdContinuity?.completedServicesCount ?? 0,
      memoryEnabled: Boolean(householdContext?.memoryEnabled),
      hasRememberedPreferences: householdContextHasUsefulMemory(householdContext),
      hasVisitSpecificUpdates,
    });
  }, [booking, householdContinuity?.completedServicesCount, householdContext]);

  const handleCheck = (item: string) => {
    setCheckedItems((prev) => prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]);
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
    if (!jobId || locationChecking) return;
    setActionError(null);
    setLocationChecking(true);
    try {
      const { lat, lon } = await getLivePosition();
      const b = await checkInBookingAsProvider(jobId, lat, lon);
      setBooking(b);
    } catch (err) {
      setActionError(visitLocationErrorMessage(err, "start"));
    } finally {
      setLocationChecking(false);
    }
  };

  const handleComplete = async () => {
    if (!jobId || !booking || locationChecking) return;
    if (checkedItems.length !== checklist.length) {
      setActionError("Complete every checklist item before finishing this visit.");
      return;
    }
    setActionError(null);
    setLocationChecking(true);
    try {
      const { lat, lon } = await getLivePosition();
      const b = await checkOutBookingAsProvider(jobId, lat, lon);
      setBooking(b);
      navigate("/csp/dashboard/jobs");
    } catch (err) {
      setActionError(visitLocationErrorMessage(err, "complete"));
    } finally {
      setLocationChecking(false);
    }
  };

  if (loading) {
    return <div className="text-white p-4 flex items-center justify-center min-h-[40vh]"><p className="text-sm text-slate-400">Loading job…</p></div>;
  }

  if (!booking) {
    return (
      <div className="text-white p-4">
        <p className="text-sm text-slate-400">Job not found.</p>
        <button onClick={() => navigate(-1)} className="text-xs text-slate-500 underline mt-2">← Back</button>
      </div>
    );
  }

  const expectedEarningsCents = Math.max(0, (booking.price_cents ?? 0) - (platformFeeCents ?? 0));
  const jobReference = booking.id.slice(0, 8).toUpperCase();
  const isWorking = booking.status === "in_progress";
  const isFinished = booking.status === "completed_by_provider" || booking.status === "confirmed";

  return (
    <div className="text-white pb-56 relative min-h-[60vh]">
      <img src="/cleanr_final-04.png" alt="" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 1, width: "360px", opacity: 0.08 }} />
      <div className="relative z-10">
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-xs text-slate-400 mb-3">← Back</button>

        <h1 className="text-xl font-semibold mb-1">Job Details</h1>
        <p className="text-[11px] text-slate-500 mb-4" title={booking.id}>Job reference · {jobReference}</p>

        <div className="mb-4"><JobStatusStepper currentStatus={jobStatus} /></div>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
          <p className="text-xs font-semibold text-slate-500 mb-1">Service address</p>
          <p className="text-sm font-semibold text-slate-900">{formatServiceAddress(booking.address)}</p>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
          <p className="text-xs font-semibold text-slate-500 mb-1">When</p>
          <p className="text-sm text-slate-900">{formatDate(booking.scheduled_start)} at {formatTime(booking.scheduled_start)}</p>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
          <p className="text-xs font-semibold text-slate-500 mb-1">Expected earnings</p>
          <p className="text-sm font-semibold text-slate-900">${(expectedEarningsCents / 100).toFixed(0)}</p>
          <p className="mt-1 text-[11px] text-slate-500">Customer total ${(booking.price_cents / 100).toFixed(0)} · Cleanr fee ${((platformFeeCents ?? 0) / 100).toFixed(0)}</p>
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
              <p className="mt-1 text-xs leading-5 text-slate-600">This is the beginning of the relationship. Learn the household, communicate clearly, and leave useful continuity for the next visit.</p>
            )}
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
          </section>
        ) : null}

        {(booking.access_notes || booking.gate_code || booking.parking_notes || booking.entry_instructions || booking.pet_notes || booking.surfaces_to_avoid) && (
          <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
            <p className="text-xs font-semibold text-slate-500 mb-1">This visit</p>
            <p className="text-[11px] text-slate-500 mb-2">Current booking details from the customer.</p>
            <dl className="space-y-2 text-sm text-slate-900">
              {booking.access_notes ? <div><dt className="text-xs text-slate-500">Access notes</dt><dd className="whitespace-pre-wrap">{booking.access_notes}</dd></div> : null}
              {booking.gate_code ? <div><dt className="text-xs text-slate-500">Gate / door code</dt><dd>{booking.gate_code}</dd></div> : null}
              {booking.parking_notes ? <div><dt className="text-xs text-slate-500">Parking</dt><dd className="whitespace-pre-wrap">{booking.parking_notes}</dd></div> : null}
              {booking.entry_instructions ? <div><dt className="text-xs text-slate-500">Entry</dt><dd className="whitespace-pre-wrap">{booking.entry_instructions}</dd></div> : null}
              {booking.pet_notes ? <div><dt className="text-xs text-slate-500">Pets</dt><dd className="whitespace-pre-wrap">{booking.pet_notes}</dd></div> : null}
              {booking.surfaces_to_avoid ? <div><dt className="text-xs text-slate-500">Surfaces to avoid</dt><dd className="whitespace-pre-wrap">{booking.surfaces_to_avoid}</dd></div> : null}
            </dl>
          </section>
        )}

        <details className="bg-violet-50 border border-violet-200 rounded-2xl mb-3 shadow-md overflow-hidden">
          <summary className="cursor-pointer list-none p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-violet-900">Cleanr Method · visit practices</p>
              <p className="mt-1 text-[11px] leading-4 text-violet-800">Carry the relationship context into the service without turning it into extra administrative work.</p>
            </div>
            <span className="text-xs font-semibold text-violet-700">View</span>
          </summary>
          <div className="px-4 pb-4 space-y-3">
            {methodPractices.map((practice) => (
              <div key={practice.key} className="rounded-xl border border-violet-200/80 bg-white/70 p-3">
                <p className="text-xs font-semibold text-slate-900">{practice.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{practice.guidance}</p>
              </div>
            ))}
          </div>
        </details>

        {actionError && (
          <div className="mb-3 rounded-xl border border-red-400/30 bg-red-950/30 px-4 py-3">
            <p className="text-sm font-medium text-red-200">{actionError}</p>
          </div>
        )}
        {availabilityHint && booking.status === "created" && <p className="text-sm text-amber-300 mb-3">{availabilityHint}</p>}

        {(booking.status === "created" || booking.status === "accepted") && (
          <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 mb-3 shadow-md">
            <p className="text-xs font-semibold text-white">{booking.status === "accepted" ? "Ready for the visit?" : "Ready to take this job?"}</p>
            <p className="mt-1 text-[11px] leading-4 text-slate-300">
              {booking.status === "accepted"
                ? "Start Job uses your current device location to verify that you are at the service address."
                : "Accepting reserves this visit to your schedule."}
            </p>
            {booking.status === "created" ? (
              <button onClick={handleAccept} className="mt-3 w-full bg-[#0A84FF] text-white py-3 rounded-xl text-sm font-semibold shadow-md shadow-[#0A84FF]/40">Accept Job</button>
            ) : (
              <button disabled={locationChecking} onClick={handleStart} className="mt-3 w-full bg-[#0A84FF] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold shadow-md shadow-[#0A84FF]/40">
                {locationChecking ? "Verifying location…" : "Start Job"}
              </button>
            )}
          </section>
        )}

        {isProviderCustomerMessagingOpen(booking.status) ? (
          <div className="grid gap-3 mb-3">
            <button type="button" onClick={() => { refetchUnread(); navigate(`/csp/dashboard/jobs/${jobId}/message`); }} className="w-full bg-white border border-slate-200 py-3 rounded-xl text-sm font-semibold text-slate-900 shadow-md relative">
              Message customer
              {unreadBookingIds.has(booking.id) ? <span className="absolute top-1/2 right-4 -translate-y-1/2 w-2 h-2 rounded-full bg-[#0A84FF]" aria-hidden /> : null}
            </button>
            <button onClick={() => navigate(`/csp/dashboard/jobs/${jobId}/incident`)} className="w-full bg-white border border-slate-200 py-3 rounded-xl text-sm font-semibold text-slate-900 shadow-md">Report Incident</button>
          </div>
        ) : null}

        {booking.status === "accepted" ? (
          <details className="group mb-3 overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/75 shadow-md">
            <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0A84FF]/15 text-[#7DBBFF]">
                  <Camera size={20} strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">Before-service photos</p>
                    <span className="rounded-full border border-slate-600 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Optional</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-slate-400">Document the starting condition when it helps protect you and the household.</p>
                </div>
                <ChevronDown size={18} className="shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
              </div>
            </summary>
            <div className="border-t border-slate-700/70 px-4 pb-4 pt-3">
              <label className="flex min-h-[74px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-600 bg-slate-950/50 px-4 py-3 transition hover:border-[#0A84FF]/70">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-300">
                  <Camera size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white">Add photos</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-slate-400">Use clear photos only when there is something worth documenting.</p>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => setBeforePhotoNames(Array.from(event.target.files ?? []).map((file) => file.name))}
                />
              </label>

              {beforePhotoNames.length > 0 ? (
                <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-emerald-200">
                    <Check size={14} />
                    <p className="text-[11px] font-semibold">{beforePhotoNames.length} photo{beforePhotoNames.length === 1 ? "" : "s"} selected</p>
                  </div>
                  <p className="mt-1 truncate text-[10px] text-emerald-200/70">{beforePhotoNames.join(", ")}</p>
                </div>
              ) : (
                <p className="mt-2 text-[10px] leading-4 text-slate-500">Skip this when the home is straightforward. Evidence should support trust, not create busywork.</p>
              )}
            </div>
          </details>
        ) : null}

        {(isWorking || isFinished) && (
          <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
            <p className="text-xs font-semibold text-slate-500 mb-1">Service checklist</p>
            <p className="text-[11px] text-slate-500 mb-3">Use the checklist during the visit. All items must be complete before checkout.</p>
            <ul className="space-y-2">
              {checklist.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <input type="checkbox" checked={checkedItems.includes(item)} onChange={() => handleCheck(item)} disabled={isFinished} className="w-4 h-4" />
                  <label className={`text-sm ${checkedItems.includes(item) ? "line-through text-slate-400" : "text-slate-900"}`}>{item}</label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isWorking && (
          <>
            <details className="bg-white border border-slate-200 rounded-2xl mb-3 shadow-md overflow-hidden">
              <summary className="cursor-pointer list-none p-4 text-xs font-semibold text-slate-600">Visit photos</summary>
              <div className="px-4 pb-4 space-y-4">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-2">Before photos</p>
                  <input type="file" multiple className="w-full text-xs text-slate-900" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 mb-2">After photos</p>
                  <input type="file" multiple className="w-full text-xs text-slate-900" />
                </div>
              </div>
            </details>

            {!isComplete && (
              <section className="rounded-2xl border border-emerald-700/40 bg-emerald-950/30 p-4 mb-3 shadow-md">
                <p className="text-xs font-semibold text-emerald-100">Finish the visit</p>
                <p className="mt-1 text-[11px] leading-4 text-emerald-200/80">Complete the checklist, then Cleanr verifies your current location before checkout.</p>
                <button disabled={locationChecking} onClick={handleComplete} className="mt-3 w-full bg-green-600 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold shadow-md">
                  {locationChecking ? "Verifying location…" : "Mark Job Complete"}
                </button>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
