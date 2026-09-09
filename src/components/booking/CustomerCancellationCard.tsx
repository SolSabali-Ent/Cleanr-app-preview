import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  confirmBookingCancellation,
  getBookingCancellationQuote,
  type BookingCancellationQuote,
} from "../../lib/bookingCancellationApi";

function money(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

type BookingState = {
  status: string;
  customer_id: string | null;
  scheduled_start: string;
};

export function CustomerCancellationCard({ bookingId, embedded = false }: { bookingId: string; embedded?: boolean }) {
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const [quote, setQuote] = useState<BookingCancellationQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"cancelled" | "refund_pending" | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) return;
      const { data, error: bookingError } = await supabase
        .from("bookings")
        .select("status,customer_id,scheduled_start")
        .eq("id", bookingId)
        .maybeSingle();
      if (!active || bookingError || !data) return;
      const row = data as BookingState;
      setEligible(
        row.customer_id === user.id &&
          ["created", "accepted"].includes(row.status) &&
          new Date(row.scheduled_start).getTime() > Date.now()
      );
    })();
    return () => {
      active = false;
    };
  }, [bookingId]);

  async function openCancellation() {
    setOpen(true);
    setError(null);
    if (quote) return;
    setLoadingQuote(true);
    try {
      setQuote(await getBookingCancellationQuote(bookingId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load the cancellation details.");
    } finally {
      setLoadingQuote(false);
    }
  }

  async function confirmCancellation() {
    if (!quote || confirming) return;
    setConfirming(true);
    setError(null);
    try {
      const result = await confirmBookingCancellation(bookingId);
      setDone(result.refund_pending ? "refund_pending" : "cancelled");
      setEligible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't cancel this visit.");
    } finally {
      setConfirming(false);
    }
  }

  if (done) {
    return (
      <section className={embedded ? "pt-4" : "mb-3 border-t border-[#E5E7EB] pt-4"}>
        <p className="text-sm font-semibold text-[#0B1220]">Visit cancelled</p>
        <p className="mt-1 text-xs leading-5 text-[#667085]">
          {done === "refund_pending"
            ? "Your refund has been submitted to the original payment method. Your bank may take a few business days to post it."
            : quote?.policy === "late"
              ? "The late-cancellation terms shown before confirmation have been applied."
              : "No cancellation fee was charged."}
        </p>
      </section>
    );
  }

  if (!eligible) return null;

  return (
    <section className={embedded ? "border-t border-[#E5E7EB] pt-4" : "mb-3 border-t border-[#E5E7EB] pt-4"}>
      {!open ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#0B1220]">Cancel visit</p>
            <p className="mt-1 text-xs text-[#667085]">See the exact cancellation terms before confirming.</p>
          </div>
          <button
            type="button"
            onClick={() => void openCancellation()}
            className="shrink-0 text-sm font-semibold text-[#B42318]"
          >
            Review
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#0B1220]">Cancel this visit?</p>
              <p className="mt-1 text-xs text-[#667085]">Review the exact terms before confirming.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-[#667085]" aria-label="Keep visit">
              <X className="h-4 w-4" />
            </button>
          </div>

          {loadingQuote ? <p className="mt-4 text-sm text-[#667085]">Checking cancellation terms…</p> : null}
          {error ? <p className="mt-4 text-sm text-[#B42318]" role="alert">{error}</p> : null}

          {quote ? (
            <>
              {quote.policy === "late" ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div>
                      <p className="text-sm font-semibold text-amber-950">Late cancellation · {money(quote.cancellation_fee_cents)}</p>
                      <p className="mt-1 text-xs leading-5 text-amber-900">
                        This visit is less than 24 hours away. You will not receive a refund. {money(quote.provider_compensation_cents)} compensates your CSP for the reserved time; {money(quote.platform_retained_cents)} remains with Cleanr.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm font-semibold text-emerald-900">Free cancellation</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    {quote.paid && quote.refund_cents > 0
                      ? `${money(quote.refund_cents)} will be returned to your original payment method.`
                      : "There is no cancellation fee."}
                  </p>
                </div>
              )}

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  disabled={confirming}
                  onClick={() => void confirmCancellation()}
                  className="min-h-11 rounded-xl bg-[#B42318] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {confirming
                    ? "Cancelling…"
                    : quote.policy === "late"
                      ? `Cancel visit · ${money(quote.cancellation_fee_cents)} fee`
                      : "Cancel visit for free"}
                </button>
                <button type="button" disabled={confirming} onClick={() => setOpen(false)} className="min-h-10 rounded-xl px-4 py-2 text-sm font-semibold text-[#475467] disabled:opacity-50">
                  Keep visit
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
