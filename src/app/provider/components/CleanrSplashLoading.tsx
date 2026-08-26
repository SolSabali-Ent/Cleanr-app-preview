import { useEffect, useState } from "react";

export const DEFAULT_CLEANR_ENTRY_SPLASH_MIN_MS = 1400;

export type CleanrSplashLoadingProps = {
  /** Public URL or import; defaults to Cleanr mark used across marketing/login. */
  logoSrc?: string;
  primaryText?: string;
  secondaryText?: string;
  /**
   * Minimum time the parent keeps this visible (ms); informational only — parent enforces timing.
   * @default {@link DEFAULT_CLEANR_ENTRY_SPLASH_MIN_MS}
   */
  minDurationMs?: number;
  className?: string;
  /** When true, fades out for handoff to dashboard. */
  exiting?: boolean;
};

/**
 * Branded full-screen entry splash for CSP dashboard boot (resolver + gate), not route transitions.
 */
export function CleanrSplashLoading({
  logoSrc = "/cleanr-app@2x.png",
  primaryText = "Loading Cleanr…",
  secondaryText = "Preparing your dashboard",
  minDurationMs = DEFAULT_CLEANR_ENTRY_SPLASH_MIN_MS,
  className = "",
  exiting = false,
}: CleanrSplashLoadingProps) {
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  void minDurationMs;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#f8fafc] px-6 transition-opacity duration-300 ease-out ${
        exiting ? "opacity-0" : fadeIn ? "opacity-100" : "opacity-0"
      } ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center max-w-sm text-center">
        <div
          className="mb-8 motion-safe:animate-[cleanrLogoPulse_2.4s_ease-in-out_infinite]"
          style={{ animationFillMode: "both" }}
        >
          <img
            src={logoSrc}
            alt="Cleanr"
            className="h-24 w-24 sm:h-28 sm:w-28 object-contain select-none"
            draggable={false}
          />
        </div>
        <p className="text-lg font-semibold tracking-tight text-slate-900">{primaryText}</p>
        <p className="mt-2 text-sm text-slate-500">{secondaryText}</p>
        <div className="mt-8 flex items-center gap-1.5" aria-hidden>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce [animation-delay:0ms]" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce [animation-delay:150ms]" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce [animation-delay:300ms]" />
        </div>
        <div
          className="mt-6 h-8 w-8 rounded-full border-2 border-slate-200 border-t-slate-500 motion-safe:animate-spin"
          aria-hidden
        />
      </div>
      <style>{`
        @keyframes cleanrLogoPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.88; transform: scale(0.985); }
        }
      `}</style>
    </div>
  );
}
