import { useLayoutEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "../app/provider/navigation/BottomNav";
import { providerTheme } from "../theme/providerTheme";
import { PageContainer } from "../components/shared/PageContainer";
import { NotificationsSlot } from "../components/notifications/NotificationsSlot";
import { CspDashboardChromeProvider, useCspDashboardChrome } from "../contexts/CspDashboardChromeContext";
import { pathnameIsGatedPreactivation } from "../lib/cspDashboardChrome";
import { CspProviderFlashDetector } from "../app/provider/components/CspProviderFlashDetector";
import { useStableSessionProfile } from "../hooks/useStableSessionProfile";

/**
 * Context from gate can lag one frame behind route changes; pathname from useLocation is synchronous
 * with the URL, so we AND them to avoid bell flash when entering gated steps.
 */
function ProviderLayoutInner() {
  const { pathname, search } = useLocation();
  const { showDashboardChrome } = useCspDashboardChrome();
  const { displayProfile } = useStableSessionProfile();
  const applicationStatus = (displayProfile?.application_status ?? "").toLowerCase();
  const isApprovedPendingProvider = Boolean(
    displayProfile?.role === "csp" &&
      displayProfile.is_onboarded === true &&
      displayProfile.marketplace_access !== true &&
      (applicationStatus === "approved" || applicationStatus === "waitlisted")
  );
  const showChrome =
    (showDashboardChrome || isApprovedPendingProvider) && !pathnameIsGatedPreactivation(pathname);
  const providerShellRef = useRef<HTMLDivElement>(null);

  // Mobile Safari/Chrome can restore the prior document position after React Router
  // changes a nested CSP route. Reset immediately and once more after layout so every
  // provider screen begins at the top instead of inheriting the previous page's scroll.
  useLayoutEffect(() => {
    const resetToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    resetToTop();
    const frame = window.requestAnimationFrame(resetToTop);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, search]);

  return (
    <div
      ref={providerShellRef}
      className="provider-app min-h-screen text-white"
      style={{ backgroundColor: providerTheme.background }}
    >
      {import.meta.env.DEV && import.meta.env.VITE_CSP_FLASH_DETECTOR !== "0" ? (
        <CspProviderFlashDetector rootRef={providerShellRef} />
      ) : null}
      {showChrome ? (
        <header
          className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-4"
          style={{ backgroundColor: providerTheme.background }}
        >
          <img
            src="/media/Cleanr_wordmark_white.png"
            alt="Cleanr"
            className="h-8 w-auto max-w-[160px] object-contain object-left"
          />
          <NotificationsSlot variant="provider" />
        </header>
      ) : null}
      <PageContainer
        maxWidth={480}
        withBottomInset={showChrome}
        className="provider-container relative flex flex-col"
      >
        <main className="flex-1 pt-6">
          <Outlet />
        </main>
      </PageContainer>
      {showChrome ? <BottomNav /> : null}
    </div>
  );
}

/** Provider shell: dark authority background; wordmark + bell + bottom nav for active or approved-pending CSP workspaces. */
export function ProviderLayout() {
  return (
    <CspDashboardChromeProvider>
      <ProviderLayoutInner />
    </CspDashboardChromeProvider>
  );
}
