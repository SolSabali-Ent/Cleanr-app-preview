import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { adminTheme } from "../../theme/adminTheme";

type DisputeRow = {
  id: string;
  booking_id: string;
  customer_id: string;
  provider_id: string;
  issue_type: string;
  description: string;
  status: "open" | "under_review" | "resolved";
  internal_note: string | null;
  resolution_outcome: "service_confirmed" | "customer_remedy_required" | null;
  created_at: string;
  reviewed_at: string | null;
  resolved_at: string | null;
};

type BookingHoldRow = {
  id: string;
  status: string;
  payout_hold_reason: string | null;
  payout_approved_at: string | null;
  payout_released: boolean;
};

type Action = "keep_under_review" | "customer_remedy_required" | "confirm_service";

const ISSUE_LABELS: Record<string, string> = {
  service_quality: "Service quality",
  damage: "Damage",
  missing_item: "Missing item",
  billing: "Billing",
  safety: "Safety",
  other: "Other",
};

export function AdminDisputePanel() {
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [bookingHolds, setBookingHolds] = useState<Record<string, BookingHoldRow>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("disputes")
      .select("id,booking_id,customer_id,provider_id,issue_type,description,status,internal_note,resolution_outcome,created_at,reviewed_at,resolved_at")
      .in("status", ["open", "under_review"])
      .order("created_at", { ascending: true });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as DisputeRow[];
    setDisputes(rows);
    setNotes((current) => {
      const next = { ...current };
      rows.forEach((row) => {
        if (!(row.id in next)) next[row.id] = row.internal_note ?? "";
      });
      return next;
    });

    const bookingIds = [...new Set(rows.map((row) => row.booking_id))];
    if (bookingIds.length > 0) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id,status,payout_hold_reason,payout_approved_at,payout_released")
        .in("id", bookingIds);
      const map: Record<string, BookingHoldRow> = {};
      ((bookings ?? []) as BookingHoldRow[]).forEach((row) => {
        map[row.id] = row;
      });
      setBookingHolds(map);
    } else {
      setBookingHolds({});
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (dispute: DisputeRow, action: Action) => {
    const note = (notes[dispute.id] ?? "").trim();
    if (note.length < 5) {
      setMessage("Add a short internal resolution note before taking action.");
      return;
    }
    setMessage(null);
    setWorkingId(dispute.id);
    try {
      const { error } = await supabase.rpc("admin_decide_booking_dispute", {
        p_dispute_id: dispute.id,
        p_action: action,
        p_internal_note: note,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage(
        action === "confirm_service"
          ? "Issue resolved: service confirmed. The payout hold is cleared, but payout requires a fresh approval before Stripe release."
          : action === "customer_remedy_required"
            ? "Customer remedy required. Booking and payout remain held while support resolves the remedy."
            : "Issue remains under review. Automatic confirmation and payout stay blocked."
      );
      await load();
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <section className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: adminTheme.textPrimary }}>Customer Issues & Dispute Holds</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5" style={{ color: adminTheme.textSecondary }}>
            Review active customer issues without treating a complaint as automatic fault. Open issues block auto-confirmation and provider payout until an operator makes an explicit decision.
          </p>
        </div>
        <div className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: adminTheme.border, color: adminTheme.textPrimary }}>
          {disputes.length} active
        </div>
      </div>

      {message ? (
        <div className="mt-3 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface, color: adminTheme.textPrimary }}>
          {message}
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm" style={{ color: adminTheme.textSecondary }}>Loading active issues…</p>
        ) : disputes.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-sm" style={{ borderColor: adminTheme.border, color: adminTheme.textSecondary }}>
            No active customer issue holds.
          </div>
        ) : (
          disputes.map((dispute) => {
            const booking = bookingHolds[dispute.booking_id];
            const busy = workingId === dispute.id;
            return (
              <article key={dispute.id} className="rounded-xl border p-4" style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.surface }}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                        {dispute.status.replace("_", " ")}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: adminTheme.textPrimary }}>
                        {ISSUE_LABELS[dispute.issue_type] ?? dispute.issue_type}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-[11px]" style={{ color: adminTheme.textSecondary }}>Booking {dispute.booking_id}</p>
                    <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6" style={{ color: adminTheme.textPrimary }}>{dispute.description}</p>
                  </div>
                  <div className="text-right text-[11px] leading-5" style={{ color: adminTheme.textSecondary }}>
                    <p>{new Date(dispute.created_at).toLocaleString()}</p>
                    <p>booking: {booking?.status ?? "—"}</p>
                    <p>payout: {booking?.payout_released ? "released" : booking?.payout_hold_reason ? `held · ${booking.payout_hold_reason.replaceAll("_", " ")}` : "not released"}</p>
                  </div>
                </div>

                <label className="mt-4 block text-xs font-semibold" style={{ color: adminTheme.textSecondary }}>
                  Internal resolution note
                </label>
                <textarea
                  value={notes[dispute.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [dispute.id]: event.target.value }))}
                  maxLength={2000}
                  placeholder="What did you review, what is still unknown, and why is this decision appropriate?"
                  className="mt-2 min-h-[92px] w-full rounded-xl border p-3 text-sm"
                  style={{ borderColor: adminTheme.border, backgroundColor: adminTheme.card, color: adminTheme.textPrimary }}
                />

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(dispute, "keep_under_review")}
                    className="min-h-[48px] rounded-xl border px-3 text-xs font-semibold disabled:opacity-50"
                    style={{ borderColor: adminTheme.border, color: adminTheme.textPrimary, backgroundColor: adminTheme.card }}
                  >
                    Keep under review
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(dispute, "customer_remedy_required")}
                    className="min-h-[48px] rounded-xl border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 disabled:opacity-50"
                  >
                    Customer remedy required
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(dispute, "confirm_service")}
                    className="min-h-[48px] rounded-xl px-3 text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: adminTheme.primary }}
                  >
                    Confirm service
                  </button>
                </div>
                <p className="mt-2 text-[10px] leading-4" style={{ color: adminTheme.textSecondary }}>
                  Confirm service resolves this issue and clears the dispute hold. It does not release money by itself; payout must be explicitly re-approved after the hold is cleared.
                </p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
