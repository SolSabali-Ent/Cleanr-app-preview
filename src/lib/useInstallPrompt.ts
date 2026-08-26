import { useEffect, useState } from "react";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Captures beforeinstallprompt and exposes deferredPrompt for install CTA.
 * Returns: canInstall, deferredPrompt, isIOS, isStandalone (already installed → hide CTA).
 */
export function useInstallPrompt(): {
  canInstall: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  isIOS: boolean;
  isStandalone: boolean;
  showPrompt: () => Promise<void>;
} {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    setIsIOS(/iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document));
    const standalone =
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true);
    setIsStandalone(!!standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const showPrompt = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
  };

  return {
    canInstall: !!deferredPrompt,
    deferredPrompt,
    isIOS,
    isStandalone,
    showPrompt,
  };
}
