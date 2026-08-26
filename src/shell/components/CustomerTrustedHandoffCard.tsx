import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TrustedServiceHandoff } from "@/domain/trustedHandoff";
import {
  getTrustedServiceHandoffForBooking,
  respondToTrustedServiceHandoff,
} from "@/lib/trustedHandoffApi";
import { isOfflinePreviewMode, supabase } from "@/lib/supabase";

function statusCopy(handoff: TrustedServiceHandoff): string {
  if (handoff.status === "active") {
    return "You and the backup CSP have both agreed. Cleanr has recorded the trusted handoff for this visit.";
  }
  if (handoff.customerConfirmedAt && !handoff.backupAcceptedAt) {
    return "You approved the backup. The handoff will not become active until the backup CSP also accepts.";
  }
  if (handoff.backupAcceptedAt && !handoff.customerConfirmedAt) {
    return "The backup CSP has agreed to cover this visit. Your approval is still required before the handoff becomes active.";
  }
  return "Your CSP proposed a trusted backup for this visit. Nothing changes until you and the backup CSP both agree.";
}

export function CustomerTrustedHandoffCard({ bookingId }: { bookingId: string }) {
  const [handoff, setHandoff] = useState<TrustedServiceHandoff | null>(null);
  const [backupName, setBackupName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (isOfflinePreviewMode) return;
    const next = await getTrustedServiceHandoffForBooking(bookingId);
    setHandoff(next);
    if (!next) {
      setBackupName(null);
      return;
    }

    const { data } = await supabase
      .from("provider_public_profiles")
      .select("full_name")
      .eq("id", next.toProviderId)
      .maybeSingle();

    setBackupName(typeof data?.full_name === "string" && data.full_name.trim() ? data.full_name.trim() : null);
  }

  useEffect(() => {
    let active = true;
    if (isOfflinePreviewMode) return;
    void refresh().catch(() => {
      if (active) setError("Trusted coverage details are temporarily unavailable.");
    });
    return () => {
      active = false;
    };
  }, [bookingId]);

  async function respond(response: "accept" | "decline") {
    if (!handoff || busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await respondToTrustedServiceHandoff(handoff.id, response);
      setHandoff(response === "decline" ? null : updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update trusted coverage.");
    } finally {
      setBusy(false);
    }
  }

  if (isOfflinePreviewMode || !handoff) return null;

  const needsCustomerResponse = !handoff.customerConfirmedAt && handoff.status !== "active";

  return (
    <section className="provider-card p-4 mb-3">
      <div className="flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#8DCC64] mt-0.5" />
        <div className="flex-1">
          <p className="section-label mb-1">Trusted coverage for this visit</p>
          <p className="text-sm font-semibold text-[#0B1220]">
            {backupName ?? "A trusted Cleanr CSP"}
          </p>
          <p className="text-xs text-[#667085] mt-1">{statusCopy(handoff)}</p>
          {handoff.reasonNote ? (
            <p className="text-xs text-[#667085] mt-2">{handoff.reasonNote}</p>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}

      {needsCustomerResponse ? (
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Button variant="primaryGreen" size="md" loading={busy} onClick={() => void respond("accept")}>
            Approve backup
          </Button>
          <Button variant="secondary" size="md" disabled={busy} onClick={() => void respond("decline")}>
            Keep current plan
          </Button>
        </div>
      ) : null}

      <p className="text-[11px] text-[#667085] mt-3">
        Cleanr records the trust transfer, but the booking remains the authoritative service record until fulfillment is formally updated.
      </p>
    </section>
  );
}
