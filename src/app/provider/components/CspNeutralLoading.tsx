/**
 * CSP dashboard: minimal loading shell (no provider/onboarding copy, no dark “authority” treatment).
 * Used while auth/profile or secondary gates resolve.
 */
export function CspNeutralLoading() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white text-slate-500">
      <div
        className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin mb-3"
        aria-hidden
      />
      <p className="text-sm">Loading…</p>
    </div>
  );
}
