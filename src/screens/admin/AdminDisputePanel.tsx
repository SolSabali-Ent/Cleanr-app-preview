import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  AdminEmptyState,
  AdminNotice,
  AdminPanel,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminSectionHeader,
  AdminStatus,
} from "./AdminUi";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
    setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    setNotes((current) => {
      const next = { ...current };
      rows.forEach((row) => { if (!(row.id in next)) next[row.id] = row.internal_note ?? ""; });
      return next;
    });

    const bookingIds = [...new Set(rows.map((row) => row.booking_id))];
    if (bookingIds.length > 0) {
      const { data: bookings } = await supabase
        .from("bookings")
        .select("id,status,payout_hold_reason,payout_approved_at,payout_released")
        .in("id", bookingIds);
      const map: Record<string, BookingHoldRow> = {};
      ((bookings ?? []) as BookingHoldRow[]).forEach((row) => { map[row.id] = row; });
      setBookingHolds(map);
    } else {
      setBookingHolds({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => disputes.find((row) => row.id === selectedId) ?? null, [disputes, selectedId]);

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
          ? "Service confirmed. The dispute hold is cleared; payout still requires fresh approval."
          : action === "customer_remedy_required"
            ? "Customer remedy required. Booking and payout remain held."
            : "Issue remains under review and payout stays held."
      );
      await load();
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <section>
      <AdminSectionHeader
        title="Customer issue holds"
        description="Open disputes that currently block automatic confirmation or payout."
        actions={<AdminStatus tone={disputes.length > 0 ? "warning" : "success"}>{disputes.length} active</AdminStatus>}
      />

      {message ? <div className="mt-3"><AdminNotice tone="info">{message}</AdminNotice></div> : null}

      {loading ? (
        <AdminPanel className="mt-3"><p className="text-sm text-slate-500">Loading active issues…</p></AdminPanel>
      ) : disputes.length === 0 ? (
        <div className="mt-3"><AdminEmptyState title="No active customer issue holds" description="New disputes will appear here only while they require operator review." /></div>
      ) : (
        <div className="mt-3 grid overflow-hidden rounded-2xl border border-slate-200 bg-white xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="border-b border-slate-200 xl:border-b-0 xl:border-r">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Review queue</div>
            <div className="divide-y divide-slate-100">
              {disputes.map((dispute) => {
                const booking = bookingHolds[dispute.booking_id];
                const active = dispute.id === selectedId;
                return (
                  <button key={dispute.id} type="button" onClick={() => setSelectedId(dispute.id)} className={`w-full px-4 py-4 text-left transition ${active ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-950">{ISSUE_LABELS[dispute.issue_type] ?? dispute.issue_type}</p>
                      <AdminStatus tone="warning">{dispute.status.replace("_", " ")}</AdminStatus>
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-slate-500">{dispute.booking_id}</p>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">{dispute.description}</p>
                    <p className="mt-2 text-[11px] text-slate-400">{booking?.payout_hold_reason ? `Payout held · ${booking.payout_hold_reason.replaceAll("_", " ")}` : "Payout not released"}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {selected ? (() => {
            const booking = bookingHolds[selected.booking_id];
            const busy = workingId === selected.id;
            return (
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{ISSUE_LABELS[selected.issue_type] ?? selected.issue_type}</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">Booking issue review</h3>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">{selected.booking_id}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{new Date(selected.created_at).toLocaleString()}</p>
                    <p className="mt-1">Booking {booking?.status ?? "—"}</p>
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-800">{selected.description}</p>

                <label className="mt-5 block text-xs font-semibold text-slate-600">Internal resolution note</label>
                <textarea
                  value={notes[selected.id] ?? ""}
                  onChange={(event) => setNotes((current) => ({ ...current, [selected.id]: event.target.value }))}
                  maxLength={2000}
                  placeholder="What did you review, what remains unknown, and why is this decision appropriate?"
                  className="mt-2 min-h-[92px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminSecondaryButton disabled={busy} onClick={() => void decide(selected, "keep_under_review")}>Keep under review</AdminSecondaryButton>
                  <button type="button" disabled={busy} onClick={() => void decide(selected, "customer_remedy_required")} className="inline-flex min-h-10 items-center rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 disabled:opacity-40">Customer remedy required</button>
                  <AdminPrimaryButton disabled={busy} onClick={() => void decide(selected, "confirm_service")}>Confirm service</AdminPrimaryButton>
                </div>

                <p className="mt-3 text-[11px] leading-5 text-slate-500">Confirming service clears the dispute hold only. It does not release money; payout still requires explicit approval afterward.</p>
              </div>
            );
          })() : null}
        </div>
      )}
    </section>
  );
}
