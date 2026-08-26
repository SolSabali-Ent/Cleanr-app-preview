import { useRef } from "react";
import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "../app/provider/navigation/BottomNav";
import { providerTheme } from "../theme/providerTheme";
import { PageContainer } from "../components/shared/PageContainer";
import { NotificationsSlot } from "../components/notifications/NotificationsSlot";
import { CspDashboardChromeProvider, useCspDashboardChrome } from "../contexts/CspDashboardChromeContext";
import { pathnameIsGatedPreactivation } from "../lib/cspDashboardChrome";
import { CspProviderFlashDetector } from "../app/provider/components/CspProviderFlashDetector";

/**
 * Context from gate can lag one frame behind route changes; pathname from useLocation is synchronous
 * with the URL, so we AND them to avoid bell flash when entering gated steps.
 */
function ProviderLayoutInner() {
  const { pathname } = useLocation();
  const { showDashboardChrome } = useCspDashboardChrome();
  const showChrome = showDashboardChrome && !pathnameIsGatedPreactivation(pathname);
  const providerShellRef = useRef<HTMLDivElement>(null);

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
          className="sticky top-0 z-10 flex justify-end items-center shrink-0 border-b border-white/10"
          style={{
            height: "48px",
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingRight: "16px",
            paddingLeft: "16px",
            backgroundColor: providerTheme.background,
          }}
        >
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

/** Provider shell: dark authority background; bell + bottom nav only when gate says marketplace dashboard. */
export function ProviderLayout() {
  return (
    <CspDashboardChromeProvider>
      <ProviderLayoutInner />
    </CspDashboardChromeProvider>
  );
}
