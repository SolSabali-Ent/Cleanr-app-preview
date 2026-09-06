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

  return (
    <div
      className={`customer-app min-h-screen ${isCustomerApp ? "customer-app-green" : ""}`}
      style={{ backgroundColor: customerTheme.background, color: customerTheme.textPrimary }}
    >
      {isCustomerApp ? (
        <header
          className="sticky top-0 z-10 flex items-center justify-between shrink-0 border-b"
          style={{
            height: "48px",
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingRight: "16px",
            paddingLeft: "16px",
            backgroundColor: customerTheme.background,
            borderColor: "rgba(14, 18, 36, 0.08)",
          }}
        >
          <span
            aria-label="Cleanr"
            className="select-none text-[34px] font-semibold leading-none tracking-[-0.06em]"
            style={{ color: customerTheme.textPrimary }}
          >
            cleanr
          </span>
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
