import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getBooking, updateCustomerBookingAccess } from "../../lib/bookingApi";
import { getMyHouseholdContext, setMyHouseholdContext } from "../../lib/householdContextApi";
import type { Booking } from "../../domain/booking";
import { BEFORE_VISIT_TRUTH_SLOTS } from "../../product/beforeVisitTruth";
import { Button } from "../../components/ui/Button";
import { ArrowLeft } from "lucide-react";
import { isUuid } from "@/utils/isUuid";
import { isOfflinePreviewMode } from "@/lib/supabase";

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

  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [servicePreferences, setServicePreferences] = useState("");
  const [memoryPetContext, setMemoryPetContext] = useState("");
  const [memorySurfacesToAvoid, setMemorySurfacesToAvoid] = useState("");
  const [communicationPreferences, setCommunicationPreferences] = useState("");
  const [memorySaving, setMemorySaving] = useState(false);
  const [memorySavedAt, setMemorySavedAt] = useState<string | null>(null);

  const validId = bookingId && isUuid(bookingId);

  useEffect(() => {
    if (!validId) {
      setLoading(false);
      return;
    }

    let active = true;
    void Promise.all([
      getBooking(bookingId),
      getMyHouseholdContext().catch(() => null),
    ]).then(([b, memory]) => {
      if (!active) return;
      setBooking(b);
      if (b) {
        setAccessNotes(b.access_notes ?? "");
        setGateCode(b.gate_code ?? "");
        setParkingNotes(b.parking_notes ?? "");
        setEntryInstructions(b.entry_instructions ?? "");
        setPetNotes(b.pet_notes ?? "");
        setSurfacesToAvoid(b.surfaces_to_avoid ?? "");
        setSavedAt(b.customer_access_updated_at ?? null);
      }
      if (memory) {
        setMemoryEnabled(memory.memoryEnabled);
        setServicePreferences(memory.servicePreferences ?? "");
        setMemoryPetContext(memory.petContext ?? "");
        setMemorySurfacesToAvoid(memory.surfacesToAvoid ?? "");
        setCommunicationPreferences(memory.communicationPreferences ?? "");
        setMemorySavedAt(memory.updatedAt);
      }
    }).catch(() => {
      if (active) setError("Could not load booking.");
    }).finally(() => {
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
      const b = await getBooking(bookingId);
      setBooking(b);
      setSavedAt(b?.customer_access_updated_at ?? new Date().toISOString());
    } catch {
      setError("Some details may need to be updated later.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMemory = async () => {
    if (isOfflinePreviewMode) return;
    setMemorySaving(true);
    setError(null);
    try {
      const saved = await setMyHouseholdContext({
        memoryEnabled,
        servicePreferences: emptyToNull(servicePreferences),
        petContext: emptyToNull(memoryPetContext),
        surfacesToAvoid: emptyToNull(memorySurfacesToAvoid),
        communicationPreferences: emptyToNull(communicationPreferences),
      });
      setMemorySavedAt(saved.updatedAt);
      if (!saved.memoryEnabled) {
        setServicePreferences("");
        setMemoryPetContext("");
        setMemorySurfacesToAvoid("");
        setCommunicationPreferences("");
      }
    } catch {
      setError("Reusable household preferences could not be saved yet.");
    } finally {
      setMemorySaving(false);
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
      <p className="text-xs text-[#667085] mb-4">Anything different this visit? Update what your CSP needs for this cleaning.</p>

      <div className="space-y-3 mb-6">
        {BEFORE_VISIT_TRUTH_SLOTS.map((slot) => (
          <section key={slot.id} className="provider-card p-3">
            <p className="section-label mb-1">{slot.title}</p>
            <p className="text-sm text-[#0B1220]">{slot.body}</p>
          </section>
        ))}
      </div>

      <section className="provider-card p-4 mb-4 space-y-3">
        <div>
          <p className="section-label">Remember for future cleanings</p>
          <p className="mt-1 text-xs text-[#667085]">Optional. Cleanr can remember reusable household preferences so you don&apos;t have to repeat them. Door codes, gate codes, and one-visit entry instructions are never stored here.</p>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-[#E5E7EB] p-3">
          <input type="checkbox" checked={memoryEnabled} onChange={(e) => setMemoryEnabled(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>
            <span className="block text-sm font-medium">Remember my reusable household preferences</span>
            <span className="block text-xs text-[#667085]">You can turn this off later. Turning it off clears the reusable preferences stored here.</span>
          </span>
        </label>

        {memoryEnabled ? (
          <>
            <label className="block text-xs font-medium text-[#667085]">How you like the service handled</label>
            <textarea className="w-full border border-[#E5E7EB] rounded-lg p-2 text-sm min-h-[72px]" value={servicePreferences} onChange={(e) => setServicePreferences(e.target.value)} placeholder="Reusable preferences that matter across visits" />
            <label className="block text-xs font-medium text-[#667085]">Pets</label>
            <textarea className="w-full border border-[#E5E7EB] rounded-lg p-2 text-sm min-h-[56px]" value={memoryPetContext} onChange={(e) => setMemoryPetContext(e.target.value)} placeholder="Only details useful across visits" />
            <label className="block text-xs font-medium text-[#667085]">Surfaces or items to avoid</label>
            <textarea className="w-full border border-[#E5E7EB] rounded-lg p-2 text-sm min-h-[56px]" value={memorySurfacesToAvoid} onChange={(e) => setMemorySurfacesToAvoid(e.target.value)} />
            <label className="block text-xs font-medium text-[#667085]">Communication preferences</label>
            <textarea className="w-full border border-[#E5E7EB] rounded-lg p-2 text-sm min-h-[56px]" value={communicationPreferences} onChange={(e) => setCommunicationPreferences(e.target.value)} placeholder="For example: text before arrival" />
          </>
        ) : null}

        <Button variant="primaryBlue" size="md" fullWidth loading={memorySaving} disabled={isOfflinePreviewMode} onClick={() => void handleSaveMemory()}>
          {memoryEnabled ? "Save reusable preferences" : "Turn off household memory"}
        </Button>
        {isOfflinePreviewMode ? <p className="text-xs text-[#667085]">Preview mode shows the real consent model; saving will be enabled when the backend is connected.</p> : memorySavedAt ? <p className="text-xs text-[#667085]">Household memory last updated {new Date(memorySavedAt).toLocaleString()}.</p> : null}
      </section>

      <section className="provider-card p-4 mb-4 space-y-3">
        <p className="section-label">This visit only</p>
        <p className="text-xs text-[#667085]">Use this for arrival/access details that belong to this booking. Last saved: {savedAt ? new Date(savedAt).toLocaleString() : "—"}. For chat, use <Link to={`/app/bookings/${booking.id}/message`} className="text-[#0A84FF] underline">Messages</Link>.</p>
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
