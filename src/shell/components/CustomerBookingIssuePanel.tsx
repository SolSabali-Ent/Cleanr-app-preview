import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ShieldAlert } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  getActiveCustomerBookingDispute,
  openCustomerBookingDispute,
  type CustomerBookingDispute,
  type CustomerDisputeIssueType,
} from "../../lib/customerDisputeApi";
import { supabase } from "../../lib/supabase";

const ISSUE_OPTIONS: Array<{ value: CustomerDisputeIssueType; label: string }> = [
  { value: "service_quality", label: "Service quality" },
  { value: "damage", label: "Property damage" },
  { value: "injury", label: "Injury" },
  { value: "missing_item", label: "Missing item" },
  { value: "billing", label: "Billing" },
  { value: "safety", label: "Safety concern" },
  { value: "other", label: "Something else" },
];

function bookingIdFromPath(pathname: string): string | null {
  const match = pathname.match(/\/bookings\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
  return match?.[1] ?? null;
}

function errorMessage(error: unknown): string {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : error instanceof Error
        ? error.message
        : String(error ?? "");

  if (raw.includes("customer_review_window_closed")) return "The 24-hour review window has closed. Contact Cleanr support for help with this visit.";
  if (raw.includes("dispute_description_too_short")) return "Tell us a little more so we can understand what happened.";
  if (raw.includes("booking_not_in_customer_review_window")) return "This visit is not currently in the customer review window.";
  return "We couldn't place the visit on hold yet. Please try again.";
}

export function CustomerBookingIssuePanel() {
  const location = useLocation();
  const bookingId = useMemo(() => bookingIdFromPath(location.pathname), [location.pathname]);
  const [bookingStatus, setBookingStatus] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [activeDispute, setActiveDispute] = useState<CustomerBookingDispute | null>(null);
  const [issueType, setIssueType] = useState<CustomerDisputeIssueType>("service_quality");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!bookingId) {
      setBookingStatus(null);
      setDeadline(null);
      setActiveDispute(null);
      return;
    }

    void Promise.all([
      supabase
        .from("bookings")
        .select("status,customer_confirmation_due_at")
        .eq("id", bookingId)
        .maybeSingle(),
      getActiveCustomerBookingDispute(bookingId).catch(() => null),
    ]).then(([bookingResult, dispute]) => {
      if (!mounted) return;
      setBookingStatus(bookingResult.data?.status ?? null);
      setDeadline(bookingResult.data?.customer_confirmation_due_at ?? null);
      setActiveDispute(dispute);
      if (dispute) setOpen(false);
    });

    return () => {
      mounted = false;
    };
  }, [bookingId]);

  if (!bookingId || (bookingStatus !== "completed_by_provider" && bookingStatus !== "disputed")) {
    return null;
  }

  if (bookingStatus === "disputed" || activeDispute) {
    return (
      <section className="mt-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <ShieldAlert size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#0B1220]">This visit is on hold</p>
            <p className="mt-1 text-xs leading-5 text-[#667085]">
              Your issue has been recorded. Automatic confirmation is paused while Cleanr reviews the visit.
            </p>
            {activeDispute ? (
              <p className="mt-2 text-xs font-medium text-amber-800">
                {ISSUE_OPTIONS.find((option) => option.value === activeDispute.issueType)?.label ?? "Issue"} · {activeDispute.status === "under_review" ? "Under review" : "Open"}
              </p>
            ) : null}
            <Link to="/trust-safety" className="mt-3 inline-block text-xs font-semibold text-[#0A84FF] underline">
              Open Trust & Safety
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setError(null);
        }}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
          <AlertTriangle size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0B1220]">Something's wrong with this visit</p>
          <p className="mt-1 text-xs leading-5 text-[#667085]">Report an issue before the review window closes. This immediately holds automatic confirmation.</p>
        </div>
        <ChevronDown size={18} className={`shrink-0 text-[#667085] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="border-t border-rose-100 p-4">
          {deadline ? (
            <p className="mb-3 text-xs font-medium text-amber-800">
              Review window ends {new Date(deadline).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.
            </p>
          ) : null}

          <label className="mb-1 block text-xs font-semibold text-[#344054]" htmlFor="cleanr-customer-issue-type">What's the issue?</label>
          <select
            id="cleanr-customer-issue-type"
            value={issueType}
            onChange={(event) => setIssueType(event.target.value as CustomerDisputeIssueType)}
            className="mb-3 w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm text-[#0B1220]"
          >
            {ISSUE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <label className="mb-1 block text-xs font-semibold text-[#344054]" htmlFor="cleanr-customer-issue-description">Tell us what happened</label>
          <textarea
            id="cleanr-customer-issue-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            placeholder="Share what you observed and what was affected."
            className="min-h-[110px] w-full rounded-xl border border-[#D0D5DD] bg-white p-3 text-sm text-[#0B1220]"
          />
          <div className="mt-1 flex justify-between gap-3 text-[10px] text-[#667085]">
            <span>Minimum 10 characters</span>
            <span>{description.length}/2000</span>
          </div>

          {issueType === "safety" || issueType === "injury" ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-800">
              If anyone needs immediate medical or emergency help, contact emergency services first. Submitting this form creates a Cleanr review hold for the booking.
            </div>
          ) : null}

          {error ? <p className="mt-3 text-xs font-medium text-red-600" role="alert">{error}</p> : null}

          <button
            type="button"
            disabled={submitting || description.trim().length < 10}
            onClick={() => void (async () => {
              if (!bookingId || description.trim().length < 10) return;
              setSubmitting(true);
              setError(null);
              try {
                const dispute = await openCustomerBookingDispute(bookingId, issueType, description.trim());
                setActiveDispute(dispute);
                setBookingStatus("disputed");
                setOpen(false);
              } catch (submitError) {
                setError(errorMessage(submitError));
              } finally {
                setSubmitting(false);
              }
            })()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B1220] py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {submitting ? "Placing visit on hold…" : <><CheckCircle2 size={16} /> Report issue & hold confirmation</>}
          </button>
          <p className="mt-2 text-[10px] leading-4 text-[#667085]">
            Reporting an issue does not automatically decide fault, insurance coverage, or outcome. It preserves the review window so Cleanr can investigate.
          </p>
        </div>
      ) : null}
    </section>
  );
}
