import { useEffect, useState } from "react";
import {
  householdMemorySuggestionFieldLabel,
  type HouseholdMemorySuggestion,
} from "@/domain/householdMemorySuggestion";
import {
  listHouseholdMemorySuggestionsForBooking,
  respondToHouseholdMemorySuggestion,
} from "@/lib/householdMemorySuggestionApi";
import { isOfflinePreviewMode } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";

export function CustomerHouseholdMemorySuggestionsCard({ bookingId }: { bookingId: string }) {
  const [suggestions, setSuggestions] = useState<HouseholdMemorySuggestion[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const rows = await listHouseholdMemorySuggestionsForBooking(bookingId);
      setSuggestions(rows);
      setDrafts((current) => {
        const next = { ...current };
        for (const row of rows) {
          if (next[row.id] == null) next[row.id] = row.suggestedText;
        }
        return next;
      });
    } catch {
      setSuggestions([]);
    }
  }

  useEffect(() => { void refresh(); }, [bookingId]);

  async function respond(item: HouseholdMemorySuggestion, response: "accepted" | "declined") {
    if (isOfflinePreviewMode || busyId) return;
    try {
      setBusyId(item.id);
      setError(null);
      await respondToHouseholdMemorySuggestion(
        item.id,
        response,
        response === "accepted" ? drafts[item.id] ?? item.suggestedText : null
      );
      await refresh();
    } catch {
      setError("This household-memory choice could not be saved yet. Make sure it contains only reusable service preferences, not access details or codes.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = suggestions.filter((item) => item.status === "pending");
  if (pending.length === 0) return null;

  return (
    <section className="provider-card p-4 mb-3">
      <p className="section-label mb-1">Remember for next time?</p>
      <p className="text-sm font-semibold text-[#0B1220]">Your CSP noticed something that may help future visits.</p>
      <p className="mt-1 text-xs leading-5 text-[#667085]">
        Nothing is saved automatically. Review, edit, or decline each suggestion. Access codes and visit-only entry details never belong in household memory.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600" role="alert">{error}</p> : null}

      <div className="mt-3 space-y-3">
        {pending.map((item) => (
          <div key={item.id} className="rounded-xl border border-[#E5E7EB] p-3">
            <p className="text-xs font-medium text-[#667085]">{householdMemorySuggestionFieldLabel(item.contextField)}</p>
            <textarea
              rows={3}
              maxLength={1000}
              disabled={isOfflinePreviewMode || busyId === item.id}
              value={drafts[item.id] ?? item.suggestedText}
              onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
              className="mt-2 w-full resize-none rounded-lg border border-[#E5E7EB] p-2 text-sm"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="primaryBlue"
                size="md"
                disabled={isOfflinePreviewMode || busyId === item.id || (drafts[item.id] ?? item.suggestedText).trim().length < 3}
                loading={busyId === item.id}
                onClick={() => void respond(item, "accepted")}
              >
                Save to household memory
              </Button>
              <Button
                variant="secondary"
                size="md"
                disabled={isOfflinePreviewMode || busyId === item.id}
                onClick={() => void respond(item, "declined")}
              >
                Don&apos;t save
              </Button>
            </div>
          </div>
        ))}
      </div>

      {isOfflinePreviewMode ? <p className="mt-3 text-xs text-[#667085]">Preview mode shows the real review flow; choices activate when the backend is connected.</p> : null}
    </section>
  );
}
