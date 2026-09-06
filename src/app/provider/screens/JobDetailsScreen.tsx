import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Camera, Check, ChevronDown, Navigation } from "lucide-react";
import {
  getBooking,
  acceptBookingAsProvider,
  checkInBookingAsProvider,
} from "../../../lib/bookingApi";
import {
  getProviderTravelState,
  markProviderEnRoute,
  providerRpcErrorMessage,
  recordProviderTravelLocation,
  type ProviderTravelState,
} from "../../../lib/providerTravelApi";
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
import SafeCompletionPanel from "../components/SafeCompletionPanel";
import { useUnreadBookingMessageIds } from "../../../hooks/useUnreadBookingMessageIds";
import { isProviderCustomerMessagingOpen } from "../../../lib/providerCustomerMessaging";

const EMPTY_TRAVEL_STATE: ProviderTravelState = {
  enRouteAt: null,
  arrivedAt: null,
  trackingActive: false,
  lastLocationAt: null,
  distanceMeters: null,
  travelOpensAt: null,
  checkInOpensAt: null,
  travelWindowOpen: false,
  checkInWindowOpen: false,
};

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

function formatClockTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDistance(distanceMeters: number | null): string | null {
  if (distanceMeters == null || !Number.isFinite(distanceMeters)) return null;
  if (distanceMeters <= 150) return "At the service address";
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m away`;
  const miles = distanceMeters / 1609.344;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi away`;
}

function distanceFromRpcError(message: string): number | null {
  const match = message.match(/provider_too_far_for_check_in:(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const distance = Number(match[1]);
  return Number.isFinite(distance) ? distance : null;
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

function relationshipHeading(relationship: ProviderHouseholdRelationshipSummary): string {
  if (relationship.relationship?.customerPreferred) return "A household that prefers working with you";
  if (relationship.completedServicesCount >= 2) return "A household you know";
  if (relationship.completedServicesCount === 1) return "A returning household";
  return "Your first visit with this household";
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

function visitLocationErrorMessage(error: unknown): string {
  const message = providerRpcErrorMessage(error);
  if (message.includes("check_in_too_early")) {
    return "Start Job opens 30 minutes before the scheduled visit.";
  }
  if (message.includes("provider_too_far_for_check_in")) {
    const distance = distanceFromRpcError(message);
    const context = formatDistance(distance);
    return context
      ? `You're ${context.toLowerCase()}. Move closer to the service address, then try Start Job again.`
      : "You're not close enough yet. You need to be at or very near the service address to start the job.";
  }
  if (message.includes("location_permission_denied")) {
    return "Location access is needed to confirm that you are at the service address. Allow location access and try again.";
  }
  if (message.includes("location_timeout")) {
    return "We couldn't confirm your location in time. Make sure location services are on and try again.";
  }
  if (message.includes("location_unavailable")) {
    return "We couldn't access your current location. Turn on location services and try again.";
  }
  if (message.includes("verified_service_address_required")) {
    return "This visit is missing a confirmed service address. Contact Cleanr support before continuing.";
  }
  if (message.includes("missing_booking_geo_location") || message.includes("missing_geo_location")) {
    return "Cleanr could not confirm the service location for this visit. Contact support before continuing.";
  }
  return `Could not start job${message ? `: ${message}` : "."}`;
}

function travelErrorMessage(error: unknown): string {
  const message = providerRpcErrorMessage(error);
  if (message.includes("en_route_too_early")) {
    return "You can mark yourself on the way 90 minutes before the scheduled visit.";
  }
  if (message.includes("location_permission_denied")) {
    return "Location access is needed when you mark yourself on the way. Allow location access and try again.";
  }
  if (message.includes("location_timeout")) {
    return "We couldn't confirm your location in time. Make sure location services are on and try again.";
  }
  if (message.includes("location_unavailable")) {
    return "We couldn't access your current location. Turn on location services and try again.";
  }
  return `Could not mark you on the way${message ? `: ${message}` : "."}`;
}

export default function JobDetailsScreen() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [platformFeeCents, setPlatformFeeCents] = useState<number | null>(null);
  const [householdContext, setHouseholdContext] = useState<HouseholdContext | null>(null);
  const [householdContinuity, setHouseholdContinuity] = useState<ProviderHouseholdRelationshipSummary | null>(null);
  const [travelState, setTravelState] = useState<ProviderTravelState>(EMPTY_TRAVEL_STATE);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [locationChecking, setLocationChecking] = useState(false);
  const [availabilityHint, setAvailabilityHint] = useState<string | null>(null);
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [beforePhotoNames, setBeforePhotoNames] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastTravelSendRef = useRef(0);
  const { unreadBookingIds, refetch: refetchUnread } = useUnreadBookingMessageIds();

  const checklist = checklistTemplates.default;

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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
    if (!jobId || booking?.status !== "accepted") {
      setTravelState(EMPTY_TRAVEL_STATE);
      return;
    }
    getProviderTravelState(jobId)
      .then((state) => {
        if (mounted) setTravelState(state);
      })
      .catch(() => {
        if (mounted) setTravelState(EMPTY_TRAVEL_STATE);
      });
    return () => {
      mounted = false;
    };
  }, [jobId, booking?.status]);

  useEffect(() => {
    if (!jobId || booking?.status !== "accepted" || !travelState.trackingActive) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastTravelSendRef.current < 45_000) return;
        lastTravelSendRef.current = now;
        void recordProviderTravelLocation(jobId, position.coords.latitude, position.coords.longitude)
          .then((state) => {
            setTravelState(state);
            if (state.arrivedAt) setActionError(null);
          })
          .catch((error) => {
            console.warn("[provider-travel] location update failed", providerRpcErrorMessage(error));
          });
      },
      (error) => {
        console.warn("[provider-travel] live watch unavailable", error.code);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 15_000,
        timeout: 20_000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [jobId, booking?.status, travelState.trackingActive]);

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

  const flowStatusMap: Record<string, string> = {
    created: "scheduled",
    accepted: "scheduled",
    in_progress: "in_progress",
    completed_by_provider: "completed",
    confirmed: "completed",
  };
  const flowStatus = booking ? (flowStatusMap[booking.status] || "scheduled") : "scheduled";
  const stepperStatus =
    booking?.status === "accepted" && travelState.arrivedAt
      ? "arrived"
      : booking?.status === "accepted" && travelState.enRouteAt
        ? "en_route"
        : flowStatus;

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
      setActionError(providerRpcErrorMessage(err) || "Could not accept job. You may not have permission.");
    }
  };

  const handleEnRoute = async () => {
    if (!jobId || locationChecking) return;
    setActionError(null);
    setLocationChecking(true);
    try {
      const { lat, lon } = await getLivePosition();
      const state = await markProviderEnRoute(jobId, lat, lon);
      lastTravelSendRef.current = Date.now();
      setTravelState(state);
    } catch (err) {
      setActionError(travelErrorMessage(err));
    } finally {
      setLocationChecking(false);
    }
  };

  const handleStart = async () => {
    if (!jobId || locationChecking) return;
    setActionError(null);
    setLocationChecking(true);
    try {
      const { lat, lon } = await getLivePosition();
      const b = await checkInBookingAsProvider(jobId, lat, lon);
      setTravelState((current) => ({ ...current, trackingActive: false }));
      setBooking(b);
    } catch (err) {
      setActionError(visitLocationErrorMessage(err));
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
  const scheduledStartMs = new Date(booking.scheduled_start).getTime();
  const travelOpensAt = travelState.travelOpensAt
    ? new Date(travelState.travelOpensAt).getTime()
    : scheduledStartMs - 90 * 60 * 1000;
  const checkInOpensAt = travelState.checkInOpensAt
    ? new Date(travelState.checkInOpensAt).getTime()
    : scheduledStartMs - 30 * 60 * 1000;
  const travelWindowOpen = nowMs >= travelOpensAt;
  const checkInWindowOpen = nowMs >= checkInOpensAt;
  const arrivalVerified = Boolean(travelState.arrivedAt);
  const distanceLabel = formatDistance(travelState.distanceMeters);

  return (
    <div className="text-white pb-56 relative min-h-[60vh]">
      <img src="/cleanr_final-04.png" alt="" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ zIndex: 1, width: "360px", opacity: 0.08 }} />
      <div className="relative z-10">
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-xs text-slate-400 mb-3">← Back</button>

        <h1 className="text-xl font-semibold mb-1">Job Details</h1>
        <p className="text-[11px] text-slate-500 mb-4" title={booking.id}>Job reference · {jobReference}</p>

        <div className="mb-4"><JobStatusStepper currentStatus={stepperStatus} /></div>

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
            <p className="text-xs font-semibold text-sky-900">Your history with this household</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{relationshipHeading(householdContinuity)}</p>
            {householdContinuity.completedServicesCount > 0 ? (
              <p className="mt-1 text-xs leading-5 text-slate-600">
                You have completed {householdContinuity.completedServicesCount} prior service{householdContinuity.completedServicesCount === 1 ? "" : "s"} with this household{householdContinuity.lastServedAt ? ` · last visit ${formatDate(householdContinuity.lastServedAt)}` : ""}.
              </p>
            ) : (
              <p className="mt-1 text-xs leading-5 text-slate-600">This is your first visit with this household. Learn what matters to them, communicate clearly, and leave helpful notes for next time.</p>
            )}
          </section>
        ) : null}

        {householdContext?.memoryEnabled ? (
          <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-3 shadow-md">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="text-xs font-semibold text-emerald-800">Saved household preferences</p>
                <p className="text-[11px] text-emerald-700 mt-1">Preferences this household chose to save for future visits.</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800">Saved with permission</span>
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
              <p className="text-xs font-semibold text-violet-900">Cleanr Method · for this visit</p>
              <p className="mt-1 text-[11px] leading-4 text-violet-800">Simple reminders to help you give good service and build trust.</p>
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
          <section className={`rounded-2xl border p-4 mb-3 shadow-md ${arrivalVerified ? "border-emerald-500/40 bg-emerald-950/25" : "border-slate-700 bg-slate-900/70"}`}>
            {booking.status === "created" ? (
              <>
                <p className="text-xs font-semibold text-white">Ready to take this job?</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-300">Accepting reserves this visit to your schedule.</p>
                <button onClick={handleAccept} className="mt-3 w-full bg-[#0A84FF] text-white py-3 rounded-xl text-sm font-semibold shadow-md shadow-[#0A84FF]/40">Accept Job</button>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${arrivalVerified ? "bg-emerald-500/15 text-emerald-300" : travelState.trackingActive ? "bg-sky-500/15 text-sky-300" : "bg-[#0A84FF]/15 text-[#7DBBFF]"}`}>
                    {arrivalVerified ? <Check size={20} /> : <Navigation size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">
                      {arrivalVerified ? "You're at the service address" : travelState.trackingActive ? "You're on the way" : "Getting to the visit"}
                    </p>
                    <p className="mt-1 text-[11px] leading-4 text-slate-300">
                      {arrivalVerified
                        ? "Cleanr confirmed you're close enough to the service address. You can start when the start time opens."
                        : travelState.trackingActive
                          ? "Cleanr uses your phone's location while this job page is open to know when you've arrived. We keep only your latest location for this trip. The customer sees updates like on the way and arrived, not your exact location."
                          : travelWindowOpen
                            ? "When you leave, tap I'm on my way. Cleanr will use your phone's location while this page is open so it can tell when you've arrived."
                            : `You can tap I'm on my way at ${formatClockTime(travelOpensAt)} — 90 minutes before the visit.`}
                    </p>
                    {distanceLabel && travelState.enRouteAt ? (
                      <p className={`mt-2 text-[11px] font-semibold ${arrivalVerified ? "text-emerald-300" : "text-sky-300"}`}>{distanceLabel}</p>
                    ) : null}
                  </div>
                </div>

                {!travelState.enRouteAt ? (
                  <>
                    <div className="mt-3 rounded-xl border border-slate-700/80 bg-slate-950/40 px-3 py-2.5">
                      <p className="text-[10px] leading-4 text-slate-400">
                        By tapping <span className="font-semibold text-slate-300">I'm on my way</span>, you allow Cleanr to use your phone's location while this job page is open. We use it to know when you've arrived and to send visit updates. We keep your latest location for the trip, not a full route history.
                      </p>
                    </div>
                    <button
                      disabled={!travelWindowOpen || locationChecking}
                      onClick={handleEnRoute}
                      className="mt-3 w-full rounded-xl border border-[#0A84FF]/50 bg-[#0A84FF]/10 py-3 text-sm font-semibold text-[#9DCCFF] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {locationChecking ? "Checking location…" : travelWindowOpen ? "I'm on my way" : `On my way opens ${formatClockTime(travelOpensAt)}`}
                    </button>
                  </>
                ) : !arrivalVerified ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-sky-500/20 bg-sky-950/20 px-3 py-2.5">
                    <div>
                      <p className="text-[11px] font-semibold text-sky-200">Waiting for you to arrive</p>
                      <p className="mt-0.5 text-[10px] text-sky-200/60">Keep Cleanr open while you're traveling so your arrival can update automatically.</p>
                    </div>
                    <Navigation size={16} className="shrink-0 text-sky-300" />
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-950/25 px-3 py-2.5 text-emerald-200">
                    <Check size={15} />
                    <span className="text-[11px] font-semibold">You're at the service address.</span>
                  </div>
                )}

                <div className={`mt-4 border-t pt-4 ${arrivalVerified ? "border-emerald-800/60" : "border-slate-700"}`}>
                  <p className="text-sm font-semibold text-white">{arrivalVerified ? "Ready to start" : "Start the service"}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-300">
                    {!checkInWindowOpen
                      ? `Start Job opens at ${formatClockTime(checkInOpensAt)} — 30 minutes before the visit.`
                      : arrivalVerified
                        ? "You're at the service address and the start time is open. Tap Start Job when you're ready to begin."
                        : "Start Job checks your phone's location. You need to be at or very near the service address."}
                  </p>
                  <button
                    disabled={!checkInWindowOpen || locationChecking}
                    onClick={handleStart}
                    className={`mt-3 w-full disabled:cursor-not-allowed disabled:opacity-45 text-white py-3 rounded-xl text-sm font-semibold shadow-md ${arrivalVerified && checkInWindowOpen ? "bg-emerald-600 shadow-emerald-900/30" : "bg-[#0A84FF] shadow-[#0A84FF]/40"}`}
                  >
                    {locationChecking
                      ? "Checking location…"
                      : !checkInWindowOpen
                        ? `Start opens ${formatClockTime(checkInOpensAt)}`
                        : arrivalVerified
                          ? "Start Job"
                          : "Check location & start"}
                  </button>
                </div>
              </>
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
                  <p className="mt-1 text-[11px] leading-4 text-slate-400">Take photos before the clean only when they help protect you and the household.</p>
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
                  <p className="mt-0.5 text-[10px] leading-4 text-slate-400">Use clear photos only when there is something worth showing.</p>
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
                <p className="mt-2 text-[10px] leading-4 text-slate-500">Skip this when there is nothing important to show. Photos should help, not create extra work.</p>
              )}
            </div>
          </details>
        ) : null}

        {(isWorking || isFinished) && (
          <section className="bg-white border border-slate-200 rounded-2xl p-4 mb-3 shadow-md">
            <p className="text-xs font-semibold text-slate-500 mb-1">Service checklist</p>
            <p className="text-[11px] text-slate-500 mb-3">Use the checklist during the visit. Finish every item before you mark the service finished.</p>
            <ul className="space-y-2">
              {checklist.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <input type="checkbox" checked={checkedItems.includes(item)} onChange={() => handleCheck(item)} disabled={isFinished || Boolean(booking.service_finished_at)} className="w-4 h-4" />
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

            <SafeCompletionPanel
              booking={booking}
              checklistComplete={checkedItems.length === checklist.length}
              onBookingChange={setBooking}
              onCompleted={() => navigate("/csp/dashboard/jobs")}
            />
          </>
        )}
      </div>
    </div>
  );
}
