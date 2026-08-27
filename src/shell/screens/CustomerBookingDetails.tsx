import { useEffect, useState, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { bookingAccessFieldsFromRow } from "../../lib/bookingApi";
import { subscribeToBooking } from "../../lib/bookingRealtime";
import type { Booking } from "../../domain/booking";
import { ArrowLeft, CalendarDays, MapPin, Star } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { supabase } from "../../lib/supabase";
import { confirmMyCompletedService } from "../../lib/serviceCompletionApi";
import { isUuid } from "@/utils/isUuid";
import { customerFacingServiceLabel } from "../../lib/serviceCatalog";
import { useUnreadBookingMessageIds } from "../../hooks/useUnreadBookingMessageIds";
import { toCustomerBookingStatusLabel } from "../../lib/customerBookingStatus";

const POLL_INTERVAL_MS = 15000;

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

export function CustomerBookingDetails() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewAlreadyExists, setReviewAlreadyExists] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [customerUserId, setCustomerUserId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [confirmationSubmitting, setConfirmationSubmitting] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isValidBookingId = isUuid(bookingId);
  const { unreadBookingIds, refetch: refetchUnread } = useUnreadBookingMessageIds();

  async function fetchBooking(nextBookingId: string): Promise<Booking | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return null;

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", nextBookingId)
      .single();
    if (bookingError || !booking) return null;

    const bookingRow = booking as Record<string, unknown>;
    const providerId =
      typeof bookingRow.provider_id === "string" && bookingRow.provider_id.trim()
        ? bookingRow.provider_id
        : null;

    let providerRow: Record<string, unknown> | null = null;
    if (providerId) {
      const { data: provider } = await supabase
        .from("provider_public_profiles")
        .select("*")
        .eq("id", providerId)
        .single();
      if (provider && typeof provider === "object") {
        providerRow = provider as Record<string, unknown>;
      }
    }

    return {
      id: bookingRow.id as string,
      customer_id: (bookingRow.customer_id as string) ?? null,
      provider_id: (bookingRow.provider_id as string) || null,
      service_type: bookingRow.service_type as string,
      address: typeof bookingRow.address === "string" ? bookingRow.address : "Address TBD",
      scheduled_start: bookingRow.scheduled_start as string,
      scheduled_end: (bookingRow.scheduled_end as string) || null,
      status: bookingRow.status as Booking["status"],
      price_cents: (bookingRow.price_cents as number) ?? 0,
      created_at: bookingRow.created_at as string,
      updated_at: bookingRow.updated_at as string,
      ...bookingAccessFieldsFromRow(bookingRow),
      provider: providerRow
        ? {
            id: String(providerRow.id ?? ""),
            full_name: (providerRow.full_name as string | null) ?? null,
            service_radius_miles: (providerRow.service_radius_miles as number | null) ?? null,
            marketplace_access: (providerRow.marketplace_access as boolean | null) ?? null,
            created_at: (providerRow.created_at as string | null) ?? null,
            avg_rating: (providerRow.avg_rating as number | null) ?? null,
            review_count: (providerRow.review_count as number | null) ?? null,
            background_checked: (providerRow.background_checked as boolean | null) ?? null,
            insured: (providerRow.insured as boolean | null) ?? null,
            platform_verified: (providerRow.platform_verified as boolean | null) ?? null,
          }
        : null,
    } as Booking;
  }

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) setCustomerUserId(data.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!bookingId || !isValidBookingId) {
      setLoading(false);
      return;
    }

    fetchBooking(bookingId)
      .then((b) => {
        setBooking(b);
        setError(null);
      })
      .catch((err) => setError(err?.message ?? "Failed to load booking"))
      .finally(() => setLoading(false));
  }, [bookingId, isValidBookingId]);

  useEffect(() => {
    if (!booking?.id || booking.status !== "confirmed" || !booking.provider_id || !customerUserId) {
      setReviewAlreadyExists(false);
      return;
    }
    if (booking.customer_id !== customerUserId) {
      setReviewAlreadyExists(false);
      return;
    }

    let mounted = true;
    void supabase
      .from("reviews")
      .select("id")
      .eq("booking_id", booking.id)
      .limit(1)
      .maybeSingle()
      .then(({ data, error: reviewLookupError }) => {
        if (!mounted) return;
        if (reviewLookupError) {
          console.warn("[customer-booking-details] review lookup failed", reviewLookupError);
          setReviewAlreadyExists(false);
          return;
        }
        setReviewAlreadyExists(Boolean(data?.id));
      });

    return () => {
      mounted = false;
    };
  }, [booking?.id, booking?.status, booking?.provider_id, booking?.customer_id, customerUserId]);

  useEffect(() => {
    if (!bookingId || !isValidBookingId) return;

    try {
      unsubRef.current = subscribeToBooking(bookingId, () => {
        void fetchBooking(bookingId).then((updated) => {
          if (updated) setBooking(updated);
        });
      });
    } catch {
      // Realtime failed; poll will run as fallback
    }

    pollRef.current = setInterval(() => {
      void fetchBooking(bookingId).then((b) => {
        if (b) setBooking(b);
      });
    }, POLL_INTERVAL_MS);

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [bookingId, isValidBookingId]);

  if (!isValidBookingId) {
    return <div className="text-sm text-[#667085]">Invalid booking ID</div>;
  }

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-sm text-[#667085]">Loading booking…</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-[#0B1220]">
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-3 h-3" />}
          className="mb-3 !px-0 text-[#667085]"
        >
          Back
        </Button>
        <p className="text-sm text-[#667085]">{error ?? "Booking not found."}</p>
      </div>
    );
  }

  const statusMessage = toCustomerBookingStatusLabel(booking.status);
  const canConfirmCompletion =
    booking.status === "completed_by_provider" &&
    Boolean(customerUserId) &&
    booking.customer_id === customerUserId;
  const canLeaveReview =
    booking.status === "confirmed" &&
    Boolean(booking.provider_id) &&
    Boolean(customerUserId) &&
    booking.customer_id === customerUserId &&
    !reviewAlreadyExists &&
    !reviewSubmitted;

  return (
    <div className="text-[#0B1220]">
      <Button
        onClick={() => navigate(-1)}
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="w-3 h-3" />}
        className="mb-3 !px-0 text-[#667085]"
      >
        Back to bookings
      </Button>

      <h1 className="text-xl font-semibold mb-2">{customerFacingServiceLabel(booking.service_type)}</h1>
      <p className="text-xs text-[#667085] mb-2">Booking ID: {booking.id}</p>
      <p className="text-sm font-medium status-green mb-4">{statusMessage}</p>
      <Link
        to={`/app/bookings/${booking.id}/prep`}
        className="text-sm font-medium text-[#0A84FF] underline mb-4 inline-block"
      >
        Before your cleaning — visit details
      </Link>

      <section className="provider-card p-4 mb-3">
        <p className="section-label mb-1">When</p>
        <p className="text-sm flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[#8DCC64]" />
          {formatDate(booking.scheduled_start)} · {formatTime(booking.scheduled_start)}
        </p>
      </section>

      <section className="provider-card p-4 mb-3">
        <p className="section-label mb-1">Where</p>
        <p className="text-sm flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#8DCC64]" />
          {booking.address}
        </p>
      </section>

      <section className="provider-card p-4 mb-3">
        <p className="section-label mb-1">Payment</p>
        <p className="text-sm font-semibold">
          ${((booking.price_cents ?? 0) / 100).toFixed(0)}
          <span className="text-xs font-normal text-[#667085] ml-1">(estimated)</span>
        </p>
      </section>

      {booking.provider?.id ? (
        <section className="provider-card p-4 mb-3">
          <p className="section-label mb-2">Assigned provider</p>
          <p className="text-sm font-semibold">
            {booking.provider.full_name ?? "Cleaning Service Professional"}
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button
              variant="secondary"
              size="md"
              className="w-full sm:flex-1 sm:min-w-0"
              onClick={() => navigate(`/app/provider/${booking.provider!.id}?bookingId=${booking.id}`)}
            >
              View provider profile
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="relative w-full sm:flex-1 sm:min-w-0"
              onClick={() => {
                refetchUnread();
                navigate(`/app/bookings/${booking.id}/message`);
              }}
            >
              Message provider
              {unreadBookingIds.has(booking.id) ? (
                <span
                  className="absolute top-1/2 right-3 -translate-y-1/2 w-2 h-2 rounded-full bg-[#0A84FF]"
                  aria-hidden
                />
              ) : null}
            </Button>
          </div>
        </section>
      ) : null}

      {canConfirmCompletion ? (
        <section className="provider-card p-4 mb-3">
          <p className="section-label mb-2">Service completed</p>
          <p className="text-sm font-semibold text-[#0B1220]">Confirm this visit</p>
          <p className="mt-1 text-sm leading-6 text-[#667085]">
            Your CSP marked the service complete. Confirming closes this transaction and leaves durable service history for the relationship. It does not create a trust score or lock you into this CSP.
          </p>
          {confirmationError ? (
            <p className="mt-3 text-sm text-red-600" role="alert">{confirmationError}</p>
          ) : null}
          <Button
            variant="primaryBlue"
            size="md"
            fullWidth
            className="mt-4"
            disabled={confirmationSubmitting}
            loading={confirmationSubmitting}
            onClick={() => void (async () => {
              setConfirmationSubmitting(true);
              setConfirmationError(null);
              try {
                await confirmMyCompletedService(booking.id);
                const refreshed = await fetchBooking(booking.id);
                if (!refreshed) throw new Error("confirmed_booking_refresh_failed");
                setBooking(refreshed);
              } catch {
                setConfirmationError("We couldn't confirm this service yet. Please try again.");
              } finally {
                setConfirmationSubmitting(false);
              }
            })()}
          >
            Confirm service completed
          </Button>
        </section>
      ) : null}

      {booking.status === "confirmed" ? (
        <section className="provider-card p-4 mb-3">
          <p className="section-label mb-1">Relationship continuity</p>
          <p className="text-sm font-semibold text-[#0B1220]">This visit is now part of your shared service history.</p>
          <p className="mt-1 text-xs leading-5 text-[#667085]">
            Future continuity can build from completed service without turning the relationship into ownership, exclusivity, or a hidden score.
          </p>
        </section>
      ) : null}

      {canLeaveReview ? (
        <section className="provider-card p-4 mb-3">
          <p className="section-label mb-2">Clean confirmed</p>
          <p className="text-sm text-[#667085] mb-3">How did everything go?</p>
          <p className="text-sm font-medium text-[#0B1220] mb-3">Leave a review</p>
          <p className="text-xs font-medium text-[#667085] mb-2">Rate your clean</p>
          {reviewError ? (
            <p className="text-sm text-red-600 mb-2" role="alert">
              {reviewError}
            </p>
          ) : null}
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setReviewRating(n)}
                className="p-1 rounded focus:outline-none focus:ring-2 focus:ring-[#0000FE]"
                aria-label={`${n} stars`}
              >
                <Star
                  className="w-8 h-8"
                  fill={reviewRating !== null && n <= reviewRating ? "#8DCC64" : "none"}
                  stroke={reviewRating !== null && n <= reviewRating ? "#8DCC64" : "#667085"}
                  strokeWidth={1.5}
                />
              </button>
            ))}
          </div>
          <label className="block text-xs font-medium text-[#667085] mb-2">Add a note</label>
          <textarea
            className="w-full border border-[#E5E7EB] rounded-lg p-2 text-sm min-h-[72px] mb-3"
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="Optional"
            maxLength={1000}
          />
          <Button
            variant="primaryBlue"
            size="md"
            fullWidth
            disabled={reviewRating === null || reviewSubmitting}
            loading={reviewSubmitting}
            onClick={() => void (async () => {
              if (reviewRating === null || !booking?.provider_id || !customerUserId) return;
              setReviewSubmitting(true);
              setReviewError(null);
              try {
                const { error: insertError } = await supabase
                  .from("reviews")
                  .insert({
                    booking_id: booking.id,
                    provider_id: booking.provider_id,
                    customer_id: customerUserId,
                    rating: reviewRating,
                    comment: reviewComment.trim() || null,
                  });
                if (insertError) throw insertError;
                setReviewSubmitted(true);
                setReviewAlreadyExists(true);
                setReviewComment("");
              } catch {
                setReviewError("We couldn't save your review. Please try again.");
              } finally {
                setReviewSubmitting(false);
              }
            })()}
          >
            Submit review
          </Button>
        </section>
      ) : null}
      {(reviewSubmitted || reviewAlreadyExists) && booking.status === "confirmed" ? (
        <p className="text-sm text-[#667085] mb-3">Thanks — your review was submitted.</p>
      ) : null}
    </div>
  );
}
