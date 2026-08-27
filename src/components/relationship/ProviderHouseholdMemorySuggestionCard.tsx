import { useEffect, useState } from "react";
import {
  HOUSEHOLD_MEMORY_SUGGESTION_FIELDS,
  householdMemorySuggestionFieldLabel,
  type HouseholdMemorySuggestion,
  type HouseholdMemorySuggestionField,
} from "@/domain/householdMemorySuggestion";
import {
  listHouseholdMemorySuggestionsForBooking,
  suggestHouseholdMemoryFromBooking,
  withdrawMyHouseholdMemorySuggestion,
} from "@/lib/householdMemorySuggestionApi";
import { isOfflinePreviewMode } from "@/lib/supabase";

export function ProviderHouseholdMemorySuggestionCard({ bookingId }: { bookingId: string }) {
  const [suggestions, setSuggestions] = useState<HouseholdMemorySuggestion[]>([]);
  const [field, setField] = useState<HouseholdMemorySuggestionField>("service_preferences");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setSuggestions(await listHouseholdMemorySuggestionsForBooking(bookingId));
    } catch {
      setSuggestions([]);
    }
  }

  useEffect(() => { void refresh(); }, [bookingId]);

  async function submit() {
    if (isOfflinePreviewMode || text.trim().length < 3 || busy) return;
    try {
      setBusy(true);
      setError(null);
      await suggestHouseholdMemoryFromBooking(bookingId, field, text);
      setText("");
      await refresh();
    } catch {
      setError("This could not be suggested. Keep it reusable and leave out access codes, credentials, and visit-only details.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(id: string) {
    if (isOfflinePreviewMode || busy) return;
    try {
      setBusy(true);
      setError(null);
      await withdrawMyHouseholdMemorySuggestion(id);
      await refresh();
    } catch {
      setError("This suggestion could not be withdrawn yet.");
    } finally {
      setBusy(false);
    }
  }

  const pending = suggestions.filter((item) => item.status === "pending");

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3 shadow-md">
      <p className="text-xs font-semibold text-amber-900">Leave useful continuity</p>
      <p className="mt-1 text-[11px] leading-4 text-amber-800">
        If you noticed a reusable preference during this visit, you can suggest it for the household to review. You cannot write to household memory yourself.
      </p>

      <div className="mt-3 space-y-2">
        <select value={field} onChange={(event) => setField(event.target.value as HouseholdMemorySuggestionField)} disabled={isOfflinePreviewMode || busy} className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-slate-900">
          {HOUSEHOLD_MEMORY_SUGGESTION_FIELDS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <p className="text-[10px] leading-4 text-amber-800">{HOUSEHOLD_MEMORY_SUGGESTION_FIELDS.find((option) => option.value === field)?.guidance}</p>
        <textarea value={text} onChange={(event) => setText(event.target.value)} disabled={isOfflinePreviewMode || busy} maxLength={500} rows={3} placeholder="Something the household may want remembered for future visits" className="w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-slate-900" />
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        <button type="button" onClick={() => void submit()} disabled={isOfflinePreviewMode || busy || text.trim().length < 3} className="w-full rounded-xl bg-amber-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
          Suggest for household review
        </button>
      </div>

      {pending.length > 0 ? (
        <div className="mt-4 border-t border-amber-200 pt-3">
          <p className="text-[11px] font-semibold text-amber-900">Waiting for household review</p>
          <div className="mt-2 space-y-2">
            {pending.map((item) => (
              <div key={item.id} className="rounded-xl border border-amber-200 bg-white/80 p-3">
                <p className="text-[10px] font-semibold text-amber-900">{householdMemorySuggestionFieldLabel(item.contextField)}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-700">{item.suggestedText}</p>
                <button type="button" onClick={() => void withdraw(item.id)} disabled={isOfflinePreviewMode || busy} className="mt-2 text-[10px] font-semibold text-amber-800 underline disabled:opacity-50">Withdraw suggestion</button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isOfflinePreviewMode ? <p className="mt-3 text-[10px] leading-4 text-amber-800">Preview mode shows the real consent flow; submitting activates with the backend.</p> : null}
    </section>
  );
}
