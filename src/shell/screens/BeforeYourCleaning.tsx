import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getBooking, updateCustomerBookingAccess } from "../../lib/bookingApi";
import type { Booking } from "../../domain/booking";
import { Button } from "../../components/ui/Button";
import { CustomerTrustedHandoffCard } from "../components/CustomerTrustedHandoffCard";
import { ArrowLeft } from "lucide-react";
import { isUuid } from "@/utils/isUuid";

function emptyToNull(s: string): string | null {
  const t = s.trim();
  return t ? t : null;
}

export function BeforeYourCleaning() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [accessNotes, setAccessNotes] = useState("");
  const [gateCode, setGateCode] = useState("");
  const [parkingNotes, setParkingNotes] = useState("");
  const [entryInstructions, setEntryInstructions] = useState("");
  const [petNotes, setPetNotes] = useState("");
  const [surfacesToAvoid, setSurfacesToAvoid] = useState("");

  const validId = bookingId && isUuid(bookingId);

  useEffect(() => {
    if (!validId) {
      setLoading(false);
      return;
    }

    let active = true;
    void getBooking(bookingId)
      .then((nextBooking) => {
        if (!active) return;
        setBooking(nextBooking);
        if (!nextBooking) return;
        setAccessNotes(nextBooking.access_notes ?? "");
        setGateCode(nextBooking.gate_code ?? "");
        setParkingNotes(nextBooking.parking_notes ?? "");
        setEntryInstructions(nextBooking.entry_instructions ?? "");
        setPetNotes(nextBooking.pet_notes ?? "");
        setSurfacesToAvoid(nextBooking.surfaces_to_avoid ?? "");
        setSavedAt(nextBooking.customer_access_updated_at ?? null);
      })
      .catch(() => {
        if (active) setError("Could not load booking.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [bookingId, validId]);

  const handleSave = async () => {
    if (!validId) return;
    setSaving(true);
    setError(null);
    try {
      await updateCustomerBookingAccess(bookingId, {
        access_notes: emptyToNull(accessNotes),
        gate_code: emptyToNull(gateCode),
        parking_notes: emptyToNull(parkingNotes),
        entry_instructions: emptyToNull(entryInstructions),
        pet_notes: emptyToNull(petNotes),
        surfaces_to_avoid: emptyToNull(surfacesToAvoid),
      });
      const nextBooking = await getBooking(bookingId);
      setBooking(nextBooking);
      setSavedAt(nextBooking?.customer_access_updated_at ?? new Date().toISOString());
    } catch {
      setError("Some details may need to be updated later.");
    } finally {
      setSaving(false);
    }
  };

  if (!validId) {
    return <p className="p-4 text-sm text-[#667085]">Invalid booking.</p>;
  }

  if (loading) {
    return <div className="p-4"><p className="text-sm text-[#667085]">Loading…</p></div>;
  }

  if (!booking) {
    return (
      <div className="p-4">
        <p className="text-sm text-[#667085]">Booking not found or you don&apos;t have access.</p>
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => navigate("/app/bookings")}>Back to bookings</Button>
      </div>
    );
  }

  return (
    <div className="text-[#0B1220] p-4 max-w-lg mx-auto">
      <Button variant="ghost" size="sm" className="!px-0 mb-3 text-[#667085]" leftIcon={<ArrowLeft className="w-3 h-3" />} onClick={() => navigate(`/app/bookings/${booking.id}`)}>Back to booking</Button>

      <h1 className="text-xl font-semibold mb-1">Before your cleaning</h1>
      <p className="text-xs text-[#667085] mb-4">Anything different this visit? Update only what your CSP needs for this cleaning.</p>

      <CustomerTrustedHandoffCard bookingId={booking.id} />

      <section className="provider-card p-4 mb-4 space-y-3">
        <div>
          <p className="section-label">This visit only</p>
          <p className="mt-1 text-xs text-[#667085]">
            Arrival and access details here stay with this booking. Reusable household memory is controlled separately in <Link to="/app/profile" className="text-[#0A84FF] underline">Profile</Link>.
          </p>
        </div>
        <p className="text-xs text-[#667085]">Last saved: {savedAt ? new Date(savedAt).toLocaleString() : "—"}. For anything conversational, use <Link to={`/app/bookings/${booking.id}/message`} className="text-[#0A84FF] underline">Messages</Link>.</p>
        {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
        <label className="block text-xs font-medium text-[#667085]">Access notes</label>
        <textarea className="w-full border border-[#E5E7EB] rounded-lg p-2 text-sm min-h-[72px]" value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} placeholder="Anything critical for arrival" />
        <label className="block text-xs font-medium text-[#667085]">Gate / door code</label>
        <input className="w-full border border-[#E5E7EB] rounded-lg p-2 text-sm" value={gateCode} onChange={(e) => setGateCode(e.target.value)} />
        <label className="block text-xs font-medium text-[#667085]">Parking</label>
        <textarea className="w-full border border-[#E5E7EB] rounded-lg p-2 text-sm min-h-[56px]" value={parkingNotes} onChange={(e) => setParkingNotes(e.target.value)} />
        <label className="block text-xs font-medium text-[#667085]">Entry instructions</label>
        <textarea className="w-full border border-[#E5E7EB] rounded-lg p-2 text-sm min-h-[56px]" value={entryInstructions} onChange={(e) => setEntryInstructions(e.target.value)} />
        <label className="block text-xs font-medium text-[#667085]">Pets for this visit</label>
        <textarea className="w-full border border-[#E5E7EB] rounded-lg p-2 text-sm min-h-[56px]" value={petNotes} onChange={(e) => setPetNotes(e.target.value)} />
        <label className="block text-xs font-medium text-[#667085]">Surfaces to avoid this visit</label>
        <textarea className="w-full border border-[#E5E7EB] rounded-lg p-2 text-sm min-h-[56px]" value={surfacesToAvoid} onChange={(e) => setSurfacesToAvoid(e.target.value)} />
        <Button variant="primaryBlue" size="md" fullWidth loading={saving} onClick={() => void handleSave()}>Save visit details</Button>
      </section>

      <p className="text-sm mb-2"><Link to="/trust-safety" className="text-[#0A84FF] underline">Trust &amp; Safety</Link></p>
    </div>
  );
}
