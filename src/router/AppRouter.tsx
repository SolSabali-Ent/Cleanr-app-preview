import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ScrollToTop } from "./ScrollToTop";
import { CustomerLayout } from "../layouts/CustomerLayout";
import { ProviderLayout } from "../layouts/ProviderLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import Landing from "../shell/screens/Landing";
import { Home as CustomerHome } from "../screens/customer/Home";
import { BookService } from "../screens/customer/BookService";
import { BookingDetails as CustomerBookingDetails } from "../screens/customer/BookingDetails";
import { CustomerBookingMessagePage } from "../screens/customer/BookingMessagePage";
import { BeforeYourCleaning } from "../shell/screens/BeforeYourCleaning";
import { Schedule } from "../screens/customer/Schedule";
import { Payments } from "../screens/customer/Payments";
import { Profile as CustomerProfile } from "../screens/customer/Profile";
import CustomerLogin from "../screens/customer/CustomerLogin";
import { Home as ProviderHome } from "../screens/provider/Home";
import { JobQueue } from "../screens/provider/JobQueue";
import { JobDetails } from "../screens/provider/JobDetails";
import { JobMessagePage } from "../screens/provider/JobMessagePage";
import { Earnings } from "../screens/provider/Earnings";
import { Availability } from "../screens/provider/Availability";
import { Profile as ProviderProfile } from "../screens/provider/Profile";
import { Calendar as ProviderCalendar } from "../screens/provider/Calendar";
import CspDashboardGate from "../app/provider/components/CspDashboardGate";
import { CspDashboardResolvedShell } from "../app/provider/components/CspDashboardResolvedShell";
import { OnboardingRoute } from "../app/provider/components/OnboardingRoute";
import ApplicationHubScreen from "../app/provider/screens/ApplicationHubScreen";
import ApplicationStepScreen from "../app/provider/screens/ApplicationStepScreen";
import ApplicationStatusScreen from "../app/provider/screens/ApplicationStatusScreen";
import CSPTermsScreen from "../app/provider/screens/CSPTermsScreen";
import CandidateReadinessScreen from "../app/provider/screens/CandidateReadinessScreen";
import ProviderVerificationScreen from "../app/provider/screens/ProviderVerificationScreen";
import { AICheck } from "../screens/provider/AICheck";
import { IncidentLog } from "../screens/provider/IncidentLog";
import CSPLogin from "../app/provider/screens/CSPLogin";
import CSPSignup from "../app/provider/screens/CSPSignup";
import GeoHarness from "../screens/admin/GeoHarness";
import { AdminBookingMessagesScreen } from "../screens/admin/AdminBookingMessagesScreen";
import { OperationsDashboard } from "../screens/admin/OperationsDashboard";
import { ProviderApplications } from "../screens/admin/ProviderApplications";
import { NotFound } from "../screens/shared/NotFound";
import { TrustSafety } from "../screens/shared/TrustSafety";
import BookingConfirmation from "../booking/BookingConfirmation";
import { ProviderOverview } from "../provider/ProviderOverview";
import { ProviderList } from "../provider/ProviderList";
import { ProviderDetail } from "../provider/ProviderDetail";
import { AuthGate } from "./AuthGate";
import { AdminGate } from "./AdminGate";
import { ProviderHub } from "../app/provider/screens/ProviderHub";
import { CustomerGate } from "./CustomerGate";

/**
 * One Cleanr platform, two role experiences.
 * Role is decided by path prefix; no role checks inside screens.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="app-shell">
        <Routes>
        {/* Runtime root route: public Cleanr landing page */}
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<CustomerLogin />} />
        <Route path="/dashboard" element={<AuthGate />} />
        <Route path="/csp" element={<ProviderHub />} />
        <Route path="/start-booking" element={<Navigate to="/book" replace />} />
        <Route path="/service" element={<Navigate to="/book" replace />} />
        <Route path="/booking-confirmed" element={<BookingConfirmation />} />
        <Route path="/trust-safety" element={<TrustSafety />} />

        {/* Customer booking flow under customer shell */}
        <Route path="/book/*" element={<CustomerLayout />}>
          <Route index element={<BookService />} />
        </Route>

        {/* Customer app: layout defines role context */}
        <Route path="/app" element={<CustomerGate><CustomerLayout /></CustomerGate>}>
          <Route index element={<CustomerHome />} />
          <Route path="bookings" element={<Schedule />} />
          <Route path="bookings/:bookingId" element={<CustomerBookingDetails />} />
          <Route path="bookings/:bookingId/prep" element={<BeforeYourCleaning />} />
          <Route path="bookings/:bookingId/message" element={<CustomerBookingMessagePage />} />
          <Route path="provider" element={<ProviderOverview />} />
          <Route path="provider/list" element={<ProviderList />} />
          <Route path="provider/:providerId" element={<ProviderDetail />} />
          <Route path="profile" element={<CustomerProfile />} />
          <Route path="payments" element={<Payments />} />
        </Route>

        {/* Provider (CSP) app: onboarding standalone (no nav); dashboard layout has bottom nav */}
        <Route path="/csp/login" element={<CSPLogin />} />
        <Route path="/csp/signup" element={<CSPSignup />} />
        <Route path="/onboarding" element={<Navigate to="/csp/dashboard" replace />} />
        <Route path="/csp/onboarding" element={<Navigate to="/csp/dashboard" replace />} />
        <Route path="/csp/dashboard" element={<ProviderLayout />}>
          <Route element={<CspDashboardResolvedShell />}>
            <Route path="candidate-readiness" element={<CandidateReadinessScreen />} />
            <Route path="onboarding" element={<OnboardingRoute />} />
            <Route path="verification" element={<ProviderVerificationScreen />} />
            <Route path="application-status" element={<ApplicationStatusScreen />} />
            <Route element={<CspDashboardGate />}>
            <Route path="terms" element={<CSPTermsScreen />} />
            <Route path="application" element={<ApplicationHubScreen />} />
            <Route path="application/:step" element={<ApplicationStepScreen />} />
            <Route index element={<ProviderHome />} />
            <Route path="jobs" element={<JobQueue />} />
            <Route path="jobs/:jobId" element={<JobDetails />} />
            <Route path="jobs/:jobId/message" element={<JobMessagePage />} />
            <Route path="jobs/:jobId/ai-check" element={<AICheck />} />
            <Route path="jobs/:jobId/incident" element={<IncidentLog />} />
            <Route path="calendar" element={<ProviderCalendar />} />
            <Route path="earnings" element={<Earnings />} />
            <Route path="availability" element={<Availability />} />
            <Route path="profile" element={<ProviderProfile />} />
            </Route>
          </Route>
        </Route>

        {/* Admin: role-checked so only profiles.role = admin can access */}
        <Route path="/admin" element={<AdminGate><AdminLayout /></AdminGate>}>
          <Route index element={<Navigate to="/admin/ops" replace />} />
          <Route path="geo" element={<GeoHarness />} />
          <Route path="ops" element={<OperationsDashboard />} />
          <Route path="booking/:bookingId/messages" element={<AdminBookingMessagesScreen />} />
          <Route path="providers" element={<ProviderApplications />} />
        </Route>

        {/* Legacy */}
        <Route path="/provider" element={<Navigate to="/csp/login" replace />} />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
