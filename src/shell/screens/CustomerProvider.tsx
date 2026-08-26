import { mockBookings } from "../mockCustomerData";
import { Sparkles, Star } from "lucide-react";
import { Button } from "../../components/ui/Button";

export function CustomerProvider() {
  const upcoming = mockBookings.find((b) => b.status === "upcoming");

  if (!upcoming) {
    return (
      <div className="text-white">
        <h1 className="text-xl font-semibold mb-2">Your provider</h1>
        <p className="text-sm text-slate-400">
          Once you book a cleaning, your assigned Cleanr Service Provider
          will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="text-white">
      <h1 className="text-xl font-semibold mb-3">Your provider</h1>

      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex gap-3">
        <div className="w-14 h-14 rounded-full bg-slate-700 flex items-center justify-center text-lg font-semibold">
          {upcoming.providerName.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {upcoming.providerName}
            </p>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400" />
              {upcoming.providerRating} · {upcoming.providerReviews}
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Detail-obsessed, pet-friendly pros.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {["Top Rated", "Verified", "Eco Products"].map((badge) => (
              <span
                key={badge}
                className="px-3 py-1 bg-slate-800 rounded-full text-[11px] text-slate-200"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>

      <Button
        className="mt-4"
        variant="secondary"
        size="lg"
        fullWidth
        leftIcon={<Sparkles className="w-3 h-3" />}
      >
        See other providers for my area
      </Button>
    </div>
  );
}

