import { Outlet, useLocation } from "react-router-dom";
import { CustomerBottomNav } from "../shell/CustomerBottomNav";
import { ProviderContextProvider } from "../provider/ProviderContext";
import { customerTheme } from "../theme/customerTheme";
import { PageContainer } from "../components/shared/PageContainer";
import { NotificationsSlot } from "../components/notifications/NotificationsSlot";
import { CustomerBookingIssuePanel } from "../shell/components/CustomerBookingIssuePanel";

/** Role context for customer: nav, tabs, headers. No role checks inside. */
export function CustomerLayout() {
  const location = useLocation();
  const isBookingFlow =
    location.pathname.startsWith("/book") ||
    location.pathname.startsWith("/booking") ||
    location.pathname.startsWith("/admin/device/public/book");
  const isCustomerApp =
    location.pathname.startsWith("/app") ||
    location.pathname.startsWith("/admin/full-app/customer") ||
    location.pathname.startsWith("/admin/device/customer");

  const goToPublicSite = () => {
    window.location.assign("/");
  };

  return (
    <div
      className={`customer-app min-h-screen ${isCustomerApp ? "customer-app-green" : ""}`}
      style={{ backgroundColor: customerTheme.background, color: customerTheme.textPrimary }}
    >
      {isCustomerApp ? (
        <header
          className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between border-b px-4"
          style={{
            backgroundColor: customerTheme.background,
            borderColor: "rgba(14, 18, 36, 0.08)",
          }}
        >
          <button
            type="button"
            onClick={goToPublicSite}
            aria-label="Back to Cleanr home"
            className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-start bg-transparent p-0 text-left"
          >
            <img
              src="/media/Cleanr_wordmark_black.png"
              alt="Cleanr"
              draggable={false}
              className="pointer-events-none h-8 w-auto max-w-[160px] select-none object-contain object-left"
            />
          </button>
          <NotificationsSlot variant="customer" />
        </header>
      ) : null}
      <PageContainer
        maxWidth={720}
        withBottomInset={!isBookingFlow}
        className="customer-container relative flex flex-col"
      >
        <ProviderContextProvider>
          <main className="flex-1 pt-6">
            <Outlet />
            <CustomerBookingIssuePanel />
          </main>
        </ProviderContextProvider>
      </PageContainer>
      {!isBookingFlow ? <CustomerBottomNav /> : null}
    </div>
  );
}
