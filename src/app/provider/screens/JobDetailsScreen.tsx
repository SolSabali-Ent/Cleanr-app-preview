import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Camera, Check, ChevronDown, MessageCircle, Navigation, ShieldAlert } from "lucide-react";
import { getBooking, acceptBookingAsProvider, checkInBookingAsProvider } from "../../../lib/bookingApi";
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
import { AppList, AppListRow, AppPageHeader, AppPanel } from "@/components/shared/AppUi";
import { CSP_PRIMARY_BUTTON, CSP_TEXT_SECONDARY } from "@/theme/cspTheme";

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
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }); } catch { return iso; }
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); } catch { return ""; }
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
    .map((segment) => segment.trim().split(/\s+/).map((word) => {
      if (/^\d+(?:-\d+)?$/.test(word)) return word;
      const upper = word.toUpperCase();
      if (uppercaseTokens.has(upper)) return upper;
      if (titleTokens.has(upper)) return upper.charAt(0) + upper.slice(1).toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(" "))
    .join(", ");
}

function relationshipHeading(relationship: ProviderHouseholdRelationshipSummary): string {
  if (relationship.relationship?.status === "paused") return "Relationship paused";
  if (relationship.relationship?.status === "active" && relationship.relationship.customerPreferred) return "Preferred by this household";
  if (relationship.completedServicesCount >= 2) return "A household you know";
  if (relationship.completedServicesCount === 1) return "A returning household";
  return "First visit together";
}

function getLivePosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("location_unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) reject(new Error("location_permission_denied"));
        else if (error.code === error.TIMEOUT) reject(new Error("location_timeout"));
        else reject(new Error("location_unavailable"));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });
}

function visitLocationErrorMessage(error: unknown): string {
  const message = providerRpcErrorMessage(error);
  if (message.includes("check_in_too_early")) return "Start Job opens 30 minutes before the scheduled visit.";
  if (message.includes("provider_too_far_for_check_in")) {
    const context = formatDistance(distanceFromRpcError(message));
    return context ? `You're ${context.toLowerCase()}. Move closer to the service address, then try again.` : "You need to be at or very near the service address to start the job.";
  }
  if (message.includes("location_permission_denied")) return "Location access is needed to confirm you are at the service address.";
  if (message.includes("location_timeout")) return "We couldn't confirm your location in time. Try again.";
  if (message.includes("location_unavailable")) return "We couldn't access your current location. Turn on location services and try again.";
  if (message.includes("verified_service_address_required")) return "This visit is missing a confirmed service address. Contact Cleanr support.";
  if (message.includes("missing_booking_geo_location") || message.includes("missing_geo_location")) return "Cleanr could not confirm the service location. Contact support.";
  return `Could not start job${message ? `: ${message}` : "."}`;
}

function travelErrorMessage(error: unknown): string {
  const message = providerRpcErrorMessage(error);
  if (message.includes("en_route_too_early")) return "You can mark yourself on the way 90 minutes before the visit.";
  if (message.includes("location_permission_denied")) return "Location access is needed when you mark yourself on the way.";
  if (message.includes("location_timeout")) return "We couldn't confirm your location in time. Try again.";
  if (message.includes("location_unavailable")) return "We couldn't access your current location. Turn on location services and try again.";
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
    if (!jobId) { setLoading(false); return; }
    getBooking(jobId).then(setBooking).finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    let mounted = true;
    if (!jobId || booking?.status !== "accepted") { setTravelState(EMPTY_TRAVEL_STATE); return; }
    getProviderTravelState(jobId).then((state) => { if (mounted) setTravelState(state); }).catch(() => { if (mounted) setTravelState(EMPTY_TRAVEL_STATE); });
    return () => { mounted = false; };
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
          .then((state) => { setTravelState(state); if (state.arrivedAt) setActionError(null); })
          .catch((error) => console.warn("[provider-travel] location update failed", providerRpcErrorMessage(error)));
      },
      (error) => console.warn("[provider-travel] live watch unavailable", error.code),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [jobId, booking?.status, travelState.trackingActive]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data: { user } }) => { if (mounted) setProviderId(user?.id ?? null); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    setPlatformFeeCents(null);
    if (!booking?.id || !providerId || booking.provider_id !== providerId) return;
    void supabase.from("bookings").select("platform_fee_cents").eq("id", booking.id).eq("provider_id", providerId).maybeSingle()
      .then(({ data, error }) => { if (mounted && !error) setPlatformFeeCents(data?.platform_fee_cents == null ? 0 : Number(data.platform_fee_cents)); });
    return () => { mounted = false; };
  }, [booking?.id, booking?.provider_id, providerId]);

  useEffect(() => {
    let mounted = true;
    setHouseholdContext(null);
    if (!booking?.id || !booking.provider_id || !providerId || booking.provider_id !== providerId) return;
    void getHouseholdContextForBooking(booking.id).then((context) => { if (mounted) setHouseholdContext(context); }).catch(() => { if (mounted) setHouseholdContext(null); });
    return () => { mounted = false; };
  }, [booking?.id, booking?.provider_id, providerId]);

  useEffect(() => {
    let mounted = true;
    setHouseholdContinuity(null);
    if (!booking?.customer_id || !booking.provider_id || !providerId || booking.provider_id !== providerId) return;
    void getMyHouseholdContinuityForCustomer(booking.customer_id).then((continuity) => { if (mounted) setHouseholdContinuity(continuity); }).catch(() => { if (mounted) setHouseholdContinuity(null); });
    return () => { mounted = false; };
  }, [booking?.customer_id, booking?.provider_id, providerId]);

  useEffect(() => {
    let mounted = true;
    if (!providerId || !booking || booking.status !== "created") { setAvailabilityHint(null); return; }
    const endISO = booking.scheduled_end ?? new Date(new Date(booking.scheduled_start).getTime() + 2 * 60 * 60 * 1000).toISOString();
    void isProviderAvailable(providerId, booking.scheduled_start, endISO)
      .then((available) => { if (mounted) setAvailabilityHint(available ? null : "This job overlaps blocked time or another booking."); })
      .catch(() => { if (mounted) setAvailabilityHint(null); });
    return () => { mounted = false; };
  }, [providerId, booking]);

  const flowStatusMap: Record<string, string> = { created: "scheduled", accepted: "scheduled", in_progress: "in_progress", completed_by_provider: "completed", confirmed: "completed" };
  const flowStatus = booking ? (flowStatusMap[booking.status] || "scheduled") : "scheduled";
  const stepperStatus = booking?.status === "accepted" && travelState.arrivedAt ? "arrived" : booking?.status === "accepted" && travelState.enRouteAt ? "en_route" : flowStatus;

  const methodPractices = useMemo(() => {
    if (!booking) return [];
    const hasVisitSpecificUpdates = Boolean(booking.access_notes || booking.gate_code || booking.parking_notes || booking.entry_instructions || booking.pet_notes || booking.surfaces_to_avoid);
    return buildCleanrMethodVisitPractices({
      completedServicesCount: householdContinuity?.completedServicesCount ?? 0,
      memoryEnabled: Boolean(householdContext?.memoryEnabled),
      hasRememberedPreferences: householdContextHasUsefulMemory(householdContext),
      hasVisitSpecificUpdates,
    });
  }, [booking, householdContinuity?.completedServicesCount, householdContext]);

  const handleCheck = (item: string) => setCheckedItems((prev) => prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]);

  const handleAccept = async () => {
    if (!jobId) return;
    setActionError(null);
    try { setBooking(await acceptBookingAsProvider(jobId)); }
    catch (err) { setActionError(providerRpcErrorMessage(err) || "Could not accept job."); }
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
    } catch (err) { setActionError(travelErrorMessage(err)); }
    finally { setLocationChecking(false); }
  };

  const handleStart = async () => {
    if (!jobId || locationChecking) return;
    setActionError(null);
    setLocationChecking(true);
    try {
      const { lat, lon } = await getLivePosition();
      setBooking(await checkInBookingAsProvider(jobId, lat, lon));
      setTravelState((current) => ({ ...current, trackingActive: false }));
    } catch (err) { setActionError(visitLocationErrorMessage(err)); }
    finally { setLocationChecking(false); }
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">Loading job…</div>;
  if (!booking) return <div className="py-6 text-sm text-slate-400">Job not found.</div>;

  const expectedEarningsCents = Math.max(0, (booking.price_cents ?? 0) - (platformFeeCents ?? 0));
  const jobReference = booking.id.slice(0, 8).toUpperCase();
  const isWorking = booking.status === "in_progress";
  const isFinished = booking.status === "completed_by_provider" || booking.status === "confirmed";
  const scheduledStartMs = new Date(booking.scheduled_start).getTime();
  const travelOpensAt = travelState.travelOpensAt ? new Date(travelState.travelOpensAt).getTime() : scheduledStartMs - 90 * 60 * 1000;
  const checkInOpensAt = travelState.checkInOpensAt ? new Date(travelState.checkInOpensAt).getTime() : scheduledStartMs - 30 * 60 * 1000;
  const travelWindowOpen = nowMs >= travelOpensAt;
  const checkInWindowOpen = nowMs >= checkInOpensAt;
  const arrivalVerified = Boolean(travelState.arrivedAt);
  const distanceLabel = formatDistance(travelState.distanceMeters);
  const hasVisitDetails = Boolean(booking.access_notes || booking.gate_code || booking.parking_notes || booking.entry_instructions || booking.pet_notes || booking.surfaces_to_avoid);

  return (
    <div className="relative min-h-[60vh] pb-40 text-white">
      <button type="button" onClick={() => navigate(-1)} className="mb-4 text-xs text-slate-400">← Jobs</button>
      <AppPageHeader tone="provider" eyebrow={`Job ${jobReference}`} title={formatDate(booking.scheduled_start)} description={`${formatTime(booking.scheduled_start)} · ${formatServiceAddress(booking.address)}`} />
      <div className="mb-5"><JobStatusStepper currentStatus={stepperStatus} /></div>

      {actionError ? <div className="mb-4 border-y border-red-400/30 bg-red-950/30 py-3 text-sm text-red-200">{actionError}</div> : null}
      {availabilityHint && booking.status === "created" ? <div className="mb-4 border-y border-amber-400/20 bg-amber-950/20 py-3 text-xs text-amber-200">{availabilityHint}</div> : null}

      {(booking.status === "created" || booking.status === "accepted") ? (
        <section className="mb-6">
          <p className="mb-2 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Next action</p>
          <AppPanel tone="provider">
            {booking.status === "created" ? (
              <>
                <p className="text-lg font-semibold">Take this job?</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>Accepting reserves the visit on your schedule.</p>
                <button type="button" onClick={handleAccept} className="mt-4 w-full rounded-xl py-3 text-sm font-semibold text-white" style={{ backgroundColor: CSP_PRIMARY_BUTTON }}>Accept job</button>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${arrivalVerified ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300"}`}>
                    {arrivalVerified ? <Check size={19} /> : <Navigation size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{arrivalVerified ? "At the service address" : travelState.trackingActive ? "On the way" : "Head to the visit"}</p>
                    <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                      {arrivalVerified
                        ? "Arrival is verified. Start when the service window opens."
                        : travelState.trackingActive
                          ? "Keep Cleanr open while traveling. The customer sees status updates, not your exact location."
                          : travelWindowOpen
                            ? "Tap when you leave so Cleanr can verify arrival."
                            : `On my way opens at ${formatClockTime(travelOpensAt)}.`}
                    </p>
                    {distanceLabel && travelState.enRouteAt ? <p className="mt-1 text-xs font-semibold text-sky-300">{distanceLabel}</p> : null}
                  </div>
                </div>

                {!travelState.enRouteAt ? (
                  <button type="button" disabled={!travelWindowOpen || locationChecking} onClick={handleEnRoute} className="mt-4 w-full rounded-xl border border-sky-500/30 bg-sky-500/10 py-3 text-sm font-semibold text-sky-200 disabled:opacity-45">
                    {locationChecking ? "Checking location…" : travelWindowOpen ? "I'm on my way" : `Opens ${formatClockTime(travelOpensAt)}`}
                  </button>
                ) : null}

                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-sm font-semibold">Start service</p>
                  <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                    {!checkInWindowOpen ? `Start opens at ${formatClockTime(checkInOpensAt)}.` : arrivalVerified ? "You're verified at the address. Start when you're ready." : "Start verifies that you're at or very near the address."}
                  </p>
                  <button type="button" disabled={!checkInWindowOpen || locationChecking} onClick={handleStart} className="mt-3 w-full rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-45" style={{ backgroundColor: arrivalVerified && checkInWindowOpen ? "#059669" : CSP_PRIMARY_BUTTON }}>
                    {locationChecking ? "Checking location…" : !checkInWindowOpen ? `Start opens ${formatClockTime(checkInOpensAt)}` : arrivalVerified ? "Start job" : "Check location & start"}
                  </button>
                </div>

                <details className="mt-3 border-t border-white/10 pt-3">
                  <summary className="cursor-pointer list-none text-[11px]" style={{ color: CSP_TEXT_SECONDARY }}>Location use</summary>
                  <p className="mt-1 text-[11px] leading-4" style={{ color: CSP_TEXT_SECONDARY }}>Cleanr uses your phone location during this trip to verify arrival. The household receives status updates, not your exact location.</p>
                </details>
              </>
            )}
          </AppPanel>
        </section>
      ) : null}

      <section className="mb-6">
        <p className="mb-2 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Visit</p>
        <AppList tone="provider">
          <AppListRow tone="provider" title="Service address" description={formatServiceAddress(booking.address)} />
          <AppListRow tone="provider" divided title="Time" description={`${formatDate(booking.scheduled_start)} · ${formatTime(booking.scheduled_start)}`} />
          <AppListRow tone="provider" divided title="Expected earnings" description={`$${(expectedEarningsCents / 100).toFixed(0)} · Customer total $${(booking.price_cents / 100).toFixed(0)} · Cleanr fee $${((platformFeeCents ?? 0) / 100).toFixed(0)}`} />
        </AppList>
      </section>

      {(householdContinuity || householdContext?.memoryEnabled || hasVisitDetails) ? (
        <section className="mb-6">
          <p className="mb-2 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Household context</p>
          <div className="space-y-2">
            {householdContinuity ? (
              <AppPanel tone="provider" padding="compact">
                <p className="text-sm font-semibold">{relationshipHeading(householdContinuity)}</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  {householdContinuity.completedServicesCount > 0 ? `${householdContinuity.completedServicesCount} prior service${householdContinuity.completedServicesCount === 1 ? "" : "s"}${householdContinuity.lastServedAt ? ` · last ${formatDate(householdContinuity.lastServedAt)}` : ""}.` : "Learn what matters to this household during the visit."}
                </p>
              </AppPanel>
            ) : null}

            {householdContext?.memoryEnabled ? (
              <details className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
                  Saved preferences
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </summary>
                <dl className="space-y-3 border-t border-white/10 px-4 py-4 text-xs">
                  {householdContext.servicePreferences ? <div><dt className="text-slate-500">Service</dt><dd className="mt-1 whitespace-pre-wrap text-slate-200">{householdContext.servicePreferences}</dd></div> : null}
                  {householdContext.petContext ? <div><dt className="text-slate-500">Pets</dt><dd className="mt-1 whitespace-pre-wrap text-slate-200">{householdContext.petContext}</dd></div> : null}
                  {householdContext.surfacesToAvoid ? <div><dt className="text-slate-500">Avoid</dt><dd className="mt-1 whitespace-pre-wrap text-slate-200">{householdContext.surfacesToAvoid}</dd></div> : null}
                  {householdContext.communicationPreferences ? <div><dt className="text-slate-500">Communication</dt><dd className="mt-1 whitespace-pre-wrap text-slate-200">{householdContext.communicationPreferences}</dd></div> : null}
                </dl>
              </details>
            ) : null}

            {hasVisitDetails ? (
              <details className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
                  Entry & visit notes
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </summary>
                <dl className="space-y-3 border-t border-white/10 px-4 py-4 text-xs">
                  {booking.access_notes ? <div><dt className="text-slate-500">Access</dt><dd className="mt-1 whitespace-pre-wrap text-slate-200">{booking.access_notes}</dd></div> : null}
                  {booking.gate_code ? <div><dt className="text-slate-500">Gate / door code</dt><dd className="mt-1 text-slate-200">{booking.gate_code}</dd></div> : null}
                  {booking.parking_notes ? <div><dt className="text-slate-500">Parking</dt><dd className="mt-1 whitespace-pre-wrap text-slate-200">{booking.parking_notes}</dd></div> : null}
                  {booking.entry_instructions ? <div><dt className="text-slate-500">Entry</dt><dd className="mt-1 whitespace-pre-wrap text-slate-200">{booking.entry_instructions}</dd></div> : null}
                  {booking.pet_notes ? <div><dt className="text-slate-500">Pets</dt><dd className="mt-1 whitespace-pre-wrap text-slate-200">{booking.pet_notes}</dd></div> : null}
                  {booking.surfaces_to_avoid ? <div><dt className="text-slate-500">Avoid</dt><dd className="mt-1 whitespace-pre-wrap text-slate-200">{booking.surfaces_to_avoid}</dd></div> : null}
                </dl>
              </details>
            ) : null}
          </div>
        </section>
      ) : null}

      {isProviderCustomerMessagingOpen(booking.status) ? (
        <section className="mb-6">
          <p className="mb-2 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Communication & safety</p>
          <AppList tone="provider">
            <AppListRow
              tone="provider"
              title="Message household"
              leading={<MessageCircle className="h-4 w-4 text-sky-300" />}
              trailing={unreadBookingIds.has(booking.id) ? <span className="h-2 w-2 rounded-full bg-[#0A84FF]" /> : undefined}
              onClick={() => { refetchUnread(); navigate(`/csp/dashboard/jobs/${jobId}/message`); }}
            />
            <AppListRow tone="provider" divided title="Report incident" leading={<ShieldAlert className="h-4 w-4 text-amber-300" />} onClick={() => navigate(`/csp/dashboard/jobs/${jobId}/incident`)} />
          </AppList>
        </section>
      ) : null}

      {booking.status === "accepted" ? (
        <details className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
            <Camera className="h-4 w-4 text-slate-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Before-service photos <span className="font-normal text-slate-500">· optional</span></p>
              <p className="mt-0.5 text-[11px] text-slate-500">Use only when something is worth documenting.</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </summary>
          <div className="border-t border-white/10 px-4 py-4">
            <label className="flex min-h-[64px] cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/15 px-3 py-3">
              <Camera className="h-4 w-4 text-slate-300" />
              <div className="min-w-0 flex-1"><p className="text-xs font-semibold">Add photos</p><p className="mt-0.5 text-[10px] text-slate-500">Clear, relevant photos only.</p></div>
              <input type="file" multiple accept="image/*" className="sr-only" onChange={(event) => setBeforePhotoNames(Array.from(event.target.files ?? []).map((file) => file.name))} />
            </label>
            {beforePhotoNames.length > 0 ? <p className="mt-2 text-[11px] text-emerald-300">{beforePhotoNames.length} photo{beforePhotoNames.length === 1 ? "" : "s"} selected</p> : null}
          </div>
        </details>
      ) : null}

      <details className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold">
          Cleanr Method for this visit
          <ChevronDown className="h-4 w-4 text-slate-500" />
        </summary>
        <div className="space-y-3 border-t border-white/10 px-4 py-4">
          {methodPractices.map((practice) => (
            <div key={practice.key}>
              <p className="text-xs font-semibold">{practice.label}</p>
              <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>{practice.guidance}</p>
            </div>
          ))}
        </div>
      </details>

      {(isWorking || isFinished) ? (
        <section className="mb-6">
          <p className="mb-2 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>Service checklist</p>
          <AppPanel tone="provider">
            <ul className="space-y-3">
              {checklist.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <input type="checkbox" checked={checkedItems.includes(item)} onChange={() => handleCheck(item)} disabled={isFinished || Boolean(booking.service_finished_at)} className="h-4 w-4" />
                  <label className={`text-sm ${checkedItems.includes(item) ? "text-slate-500 line-through" : "text-slate-100"}`}>{item}</label>
                </li>
              ))}
            </ul>
          </AppPanel>
        </section>
      ) : null}

      {isWorking ? (
        <>
          <details className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold">Visit photos</summary>
            <div className="space-y-4 border-t border-white/10 px-4 py-4">
              <div><p className="mb-2 text-[11px] text-slate-500">Before</p><input type="file" multiple className="w-full text-xs" /></div>
              <div><p className="mb-2 text-[11px] text-slate-500">After</p><input type="file" multiple className="w-full text-xs" /></div>
            </div>
          </details>
          <SafeCompletionPanel booking={booking} checklistComplete={checkedItems.length === checklist.length} onBookingChange={setBooking} onCompleted={() => navigate("/csp/dashboard/jobs")} />
        </>
      ) : null}
    </div>
  );
}
