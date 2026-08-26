import { Outlet, useLocation } from "react-router-dom";
import { CustomerBottomNav } from "../shell/CustomerBottomNav";
import { ProviderContextProvider } from "../provider/ProviderContext";
import { customerTheme } from "../theme/customerTheme";
import { PageContainer } from "../components/shared/PageContainer";
import { NotificationsSlot } from "../components/notifications/NotificationsSlot";

/** Role context for customer: nav, tabs, headers. No role checks inside. */
export function CustomerLayout() {
  const location = useLocation();
  const isBookingFlow =
    location.pathname.startsWith("/book") || location.pathname.startsWith("/booking");
  const isCustomerApp = location.pathname.startsWith("/app");

  return (
    <div
      className={`customer-app min-h-screen ${isCustomerApp ? "customer-app-green" : ""}`}
      style={{ backgroundColor: customerTheme.background, color: customerTheme.textPrimary }}
    >
      {isCustomerApp ? (
        <header
          className="sticky top-0 z-10 flex justify-end items-center shrink-0 border-b"
          style={{
            height: "48px",
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingRight: "16px",
            paddingLeft: "16px",
            backgroundColor: customerTheme.background,
            borderColor: "rgba(14, 18, 36, 0.08)",
          }}
        >
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
          </main>
        </ProviderContextProvider>
      </PageContainer>
      {!isBookingFlow ? <CustomerBottomNav /> : null}
    </div>
  );
}
