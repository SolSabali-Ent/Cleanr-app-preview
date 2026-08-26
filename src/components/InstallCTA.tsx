import { useEffect } from "react";
import { useInstallPrompt } from "../lib/useInstallPrompt";
import { track } from "../lib/analytics";

type InstallCTAProps = {
  onShown?: () => void;
  className?: string;
};

/**
 * Install CTA: uses beforeinstallprompt when available, or A2HS instructions on iOS.
 * Call onShown when displayed so callers can track.
 */
export function InstallCTA({ onShown, className = "" }: InstallCTAProps) {
  const { canInstall, isIOS, isStandalone, showPrompt } = useInstallPrompt();

  useEffect(() => {
    if (canInstall || isIOS) track("install_prompt_shown");
  }, [canInstall, isIOS]);

  if (isStandalone) return null;
  if (!canInstall && !isIOS) return null;

  const handleClick = () => {
    track("install_clicked");
    onShown?.();
    if (canInstall) showPrompt();
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        className="w-full btn border-2 border-[#0A84FF] bg-[#0A84FF]/10 text-[#0A84FF] text-sm"
      >
        {canInstall ? "Install Cleanr app" : "Add to Home Screen"}
      </button>
      {isIOS && !canInstall && (
        <p className="mt-2 text-xs text-slate-500 text-center">
          Tap the share icon in Safari, then &quot;Add to Home Screen&quot;.
        </p>
      )}
    </div>
  );
}
