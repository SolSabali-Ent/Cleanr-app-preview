import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { KinexDrainAuditCard } from "./KinexDrainAuditCard";
import { AdminDisputePanel } from "./AdminDisputePanel";
import {
  AdminNotice,
  AdminPanel,
  AdminPrimaryButton,
  AdminSecondaryButton,
  AdminSectionHeader,
  AdminStatStrip,
  AdminStatus,
  AdminTableShell,
} from "./AdminUi";

type PendingBookingRow = {
  id: string;
  status: string;
  provider_id: string | null;
  service_relationship_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  updated_at: string;
};

type OutboxRow = {
  id: string;
  event_type: string;
  booking_id: string | null;
  status: string;
  attempt_count: number | null;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  sent_at: string | null;
  payload: Record<string, unknown> | null;
};

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function KinexHandoffPanel() {
  const [bookings, setBookings] = useState<PendingBookingRow[]>([]);
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [relationshipDeliveryEnabled, setRelationshipDeliveryEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draining, setDraining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    const [bookingResult, outboxResult, settingResult] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,status,provider_id,service_relationship_id,stripe_payment_intent_id,created_at,updated_at")
        .not("service_relationship_id", "is", null)
        .not("stripe_payment_intent_id", "is", null)
        .is("provider_id", null)
        .eq("status", "created")
        .order("updated_at", { ascending: true })
        .limit(50),
      supabase
        .from("kinex_event_outbox")
        .select("id,event_type,booking_id,status,attempt_count,last_error,next_retry_at,created_at,sent_at,payload")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "kinex_relationship_assignment_delivery_enabled")
        .maybeSingle(),
    ]);

    const errors: string[] = [];
    if (bookingResult.error) errors.push(`relationship assignments: ${bookingResult.error.message}`);
    else setBookings((bookingResult.data ?? []) as PendingBookingRow[]);

    if (outboxResult.error) errors.push(`Kinex outbox: ${outboxResult.error.message}`);
    else setOutbox((outboxResult.data ?? []) as OutboxRow[]);

    if (settingResult.error) errors.push(`relationship delivery gate: ${settingResult.error.message}`);
    else setRelationshipDeliveryEnabled(String(settingResult.data?.value ?? "false").toLowerCase() === "true");

    setError(errors.length ? errors.join(" · ") : null);
    setLoading(false);
  }

  async function drainOrdinaryEvents() {
    if (draining) return;
    setDraining(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("admin-process-kinex-outbox", {
        body: { batch_size: 10 },
      });
      if (invokeError) throw invokeError;
      const result = data?.result ?? data;
      const claimed = Number(result?.claimed ?? 0);
      const sent = Number(result?.sent ?? 0);
      const failed = Number(result?.failed ?? 0);
      const runId = data?.run_id ? String(data.run_id) : null;
      setNotice(`Drain complete: ${claimed} claimed · ${sent} sent · ${failed} failed${runId ? ` · audit ${runId}` : ""}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to drain the Kinex outbox.");
    } finally {
      setDraining(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const health = useMemo(() => {
    const queued = outbox.filter((row) => row.status === "queued").length;
    const processing = outbox.filter((row) => row.status === "processing").length;
    const failed = outbox.filter((row) => row.status === "failed").length;
    const sent = outbox.filter((row) => row.status === "sent").length;
    const bookingConfirmed = outbox.filter((row) => row.event_type === "booking_confirmed");
    const failedConfirmed = bookingConfirmed.filter((row) => row.status === "failed").length;
    const heldRelationshipConfirmed = bookingConfirmed.filter(
      (row) => row.status === "queued" && row.payload?.relationship_assignment_pending === true && !relationshipDeliveryEnabled
    ).length;
    return { queued, processing, failed, sent, failedConfirmed, heldRelationshipConfirmed };
  }, [outbox, relationshipDeliveryEnabled]);

  return (
    <div className="space-y-6">
      <AdminDisputePanel />

      <section>
        <AdminSectionHeader
          title="Kinex handoff"
          description="Transport and reconciliation health across the Cleanr → Kinex boundary."
          actions={
            <>
              <AdminSecondaryButton disabled={loading} onClick={() => void load()}>{loading ? "Refreshing…" : "Refresh"}</AdminSecondaryButton>
              <AdminPrimaryButton disabled={draining} onClick={() => void drainOrdinaryEvents()}>{draining ? "Draining…" : "Drain ordinary events"}</AdminPrimaryButton>
            </>
          }
        />

        {error ? <div className="mt-3"><AdminNotice tone="warning">{error}</AdminNotice></div> : null}
        {notice ? <div className="mt-3"><AdminNotice tone="success">{notice}</AdminNotice></div> : null}

        <div className="mt-3">
          <AdminStatStrip
            items={[
              { label: "Pending assignment", value: bookings.length, detail: "Paid relationship bookings awaiting provider reconciliation" },
              { label: "Held relationship events", value: health.heldRelationshipConfirmed, detail: relationshipDeliveryEnabled ? "Gate enabled" : "Held intentionally" },
              { label: "Outbox queued", value: health.queued, detail: `${health.processing} processing` },
              { label: "Outbox failed", value: health.failed, detail: `${health.failedConfirmed} booking confirmations · ${health.sent} sent` },
            ]}
          />
        </div>

        <AdminPanel className="mt-3" padding="compact">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-900">Relationship assignment delivery</p>
              <p className="mt-1 text-xs text-slate-500">Relationship-pending booking confirmations remain protected by a separate delivery gate.</p>
            </div>
            <AdminStatus tone={relationshipDeliveryEnabled ? "success" : "warning"}>{relationshipDeliveryEnabled ? "Enabled" : "Held intentionally"}</AdminStatus>
          </div>
        </AdminPanel>

        {bookings.length > 0 ? (
          <div className="mt-3">
            <AdminTableShell>
              <div className="grid grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_190px_130px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <span>Booking</span><span>Relationship</span><span>Waiting since</span><span>Inspect</span>
              </div>
              {bookings.map((booking) => (
                <div key={booking.id} className="grid grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_190px_130px] items-center gap-4 border-b border-slate-200 px-5 py-4 text-xs last:border-b-0">
                  <span className="truncate font-mono text-slate-700">{booking.id}</span>
                  <span className="truncate font-mono text-slate-500">{booking.service_relationship_id ?? "—"}</span>
                  <span className="text-slate-500">{formatTimestamp(booking.updated_at || booking.created_at)}</span>
                  <Link to={`/admin/full-app/customer/bookings/${booking.id}`} className="font-semibold text-[#0000FE] hover:underline">Inspect</Link>
                </div>
              ))}
            </AdminTableShell>
          </div>
        ) : null}

        <details className="mt-3 rounded-2xl border border-slate-200 bg-white">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-slate-950">Transport diagnostics</summary>
          <div className="space-y-4 border-t border-slate-200 px-5 py-4">
            <KinexDrainAuditCard />
            <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
              Cleanr persists payment, relationship context, and durable assignment truth. Kinex owns orchestration and routing. Relationship-pending delivery remains gated until the Kinex routing migration and callback worker are verified live; ordinary lifecycle events may still be drained independently.
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
