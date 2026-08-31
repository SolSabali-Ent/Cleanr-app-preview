import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ScrollToTop } from "./ScrollToTop";
import { LegacyHostRedirect } from "./LegacyHostRedirect";
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
import GrowthScreen from "../app/provider/screens/GrowthScreen";
import CapabilitiesScreen from "../app/provider/screens/CapabilitiesScreen";
import GrowthOpportunitiesScreen from "../app/provider/screens/GrowthOpportunitiesScreen";
import ContributionsScreen from "../app/provider/screens/ContributionsScreen";
import MilestonesScreen from "../app/provider/screens/MilestonesScreen";
import NetworkScreen from "../app/provider/screens/NetworkScreen";
import ExistingClientsScreen from "../app/provider/screens/ExistingClientsScreen";
import FoundingCircleJoin from "../app/provider/screens/FoundingCircleJoin";
import { CSP_GROWTH_ROUTES } from "../app/provider/growthRoutes";
import { AICheck } from "../screens/provider/AICheck";
import { IncidentLog } from "../screens/provider/IncidentLog";
import CSPLogin from "../app/provider/screens/CSPLogin";
import CSPSignup from "../app/provider/screens/CSPSignup";
import GeoHarness from "../screens/admin/GeoHarness";
import { AdminAccess } from "../screens/admin/AdminAccess";
import { AdminBookingMessagesScreen } from "../screens/admin/AdminBookingMessagesScreen";
import { FoundingCircle } from "../screens/admin/FoundingCircle";
import { OperationsDashboard } from "../screens/admin/OperationsDashboard";
import { ProviderApplications } from "../screens/admin/ProviderApplications";
import { AdminFullAppIndex, AdminFullAppShell, AdminProviderPreviewOutlet } from "../screens/admin/AdminFullApp";
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

export function AppRouter() {
  return (
    <BrowserRouter>
      <LegacyHostRedirect />
      <ScrollToTop />
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signin" element={<CustomerLogin />} />
          <Route path="/dashboard" element={<AuthGate />} />
          <Route path="/csp" element={<ProviderHub />} />
          <Route path="/csp/founding-circle" element={<FoundingCircleJoin />} />
          <Route path="/start-booking" element={<Navigate to="/book" replace />} />
          <Route path="/service" element={<Navigate to="/book" replace />} />
          <Route path="/booking-confirmed" element={<BookingConfirmation />} />
          <Route path="/trust-safety" element={<TrustSafety />} />
          <Route path="/book/*" element={<CustomerLayout />}><Route index element={<BookService />} /></Route>

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

          <Route path="/csp/login" element={<CSPLogin />} />
          <Route path="/csp/signup" element={<CSPSignup />} />
          <Route path="/onboarding" element={<Navigate to="/csp/dashboard" replace />} />
          <Route path="/csp/onboarding" element={<Navigate to="/csp/dashboard" replace />} />

          <Route path="/csp/growth" element={<ProviderLayout />}>
            <Route element={<CspDashboardResolvedShell />}>
              <Route element={<CspDashboardGate />}>
                <Route index element={<GrowthScreen />} />
                <Route path="milestones" element={<MilestonesScreen />} />
                <Route path="capabilities" element={<CapabilitiesScreen />} />
                <Route path="opportunities" element={<GrowthOpportunitiesScreen />} />
                <Route path="fit" element={<Navigate to={CSP_GROWTH_ROUTES.opportunities} replace />} />
                <Route path="network" element={<NetworkScreen />} />
                <Route path="contributions" element={<ContributionsScreen />} />
              </Route>
            </Route>
          </Route>

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
                <Route path="growth" element={<Navigate to={CSP_GROWTH_ROUTES.home} replace />} />
                <Route path="growth/milestones" element={<Navigate to={CSP_GROWTH_ROUTES.milestones} replace />} />
                <Route path="growth/capabilities" element={<Navigate to={CSP_GROWTH_ROUTES.capabilities} replace />} />
                <Route path="growth/opportunities" element={<Navigate to={CSP_GROWTH_ROUTES.opportunities} replace />} />
                <Route path="growth/opportunities/fit" element={<Navigate to={CSP_GROWTH_ROUTES.opportunities} replace />} />
                <Route path="growth/network" element={<Navigate to={CSP_GROWTH_ROUTES.network} replace />} />
                <Route path="growth/contributions" element={<Navigate to={CSP_GROWTH_ROUTES.contributions} replace />} />
                <Route path="existing-clients" element={<ExistingClientsScreen />} />
                <Route path="availability" element={<Availability />} />
                <Route path="profile" element={<ProviderProfile />} />
              </Route>
            </Route>
          </Route>

          <Route path="/admin" element={<AdminGate><AdminLayout /></AdminGate>}>
            <Route index element={<Navigate to="/admin/ops" replace />} />
            <Route path="geo" element={<GeoHarness />} />
            <Route path="ops" element={<OperationsDashboard />} />
            <Route path="founding-circle" element={<FoundingCircle />} />
            <Route path="access" element={<AdminAccess />} />
            <Route path="booking/:bookingId/messages" element={<AdminBookingMessagesScreen />} />
            <Route path="providers" element={<ProviderApplications />} />
          </Route>

          <Route path="/admin/full-app" element={<AdminGate><AdminFullAppShell /></AdminGate>}>
            <Route index element={<AdminFullAppIndex />} />

            <Route path="customer" element={<CustomerLayout />}>
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

            <Route path="csp" element={<ProviderLayout />}>
              <Route element={<AdminProviderPreviewOutlet />}>
                <Route index element={<ProviderHome />} />
                <Route path="candidate-readiness" element={<CandidateReadinessScreen />} />
                <Route path="onboarding" element={<OnboardingRoute />} />
                <Route path="verification" element={<ProviderVerificationScreen />} />
                <Route path="application-status" element={<ApplicationStatusScreen />} />
                <Route path="terms" element={<CSPTermsScreen />} />
                <Route path="application" element={<ApplicationHubScreen />} />
                <Route path="application/:step" element={<ApplicationStepScreen />} />
                <Route path="jobs" element={<JobQueue />} />
                <Route path="jobs/:jobId" element={<JobDetails />} />
                <Route path="jobs/:jobId/message" element={<JobMessagePage />} />
                <Route path="jobs/:jobId/ai-check" element={<AICheck />} />
                <Route path="jobs/:jobId/incident" element={<IncidentLog />} />
                <Route path="calendar" element={<ProviderCalendar />} />
                <Route path="earnings" element={<Earnings />} />
                <Route path="existing-clients" element={<ExistingClientsScreen />} />
                <Route path="availability" element={<Availability />} />
                <Route path="profile" element={<ProviderProfile />} />
                <Route path="growth" element={<GrowthScreen />} />
                <Route path="growth/milestones" element={<MilestonesScreen />} />
                <Route path="growth/capabilities" element={<CapabilitiesScreen />} />
                <Route path="growth/opportunities" element={<GrowthOpportunitiesScreen />} />
                <Route path="growth/network" element={<NetworkScreen />} />
                <Route path="growth/contributions" element={<ContributionsScreen />} />
              </Route>
            </Route>
          </Route>

          <Route path="/provider" element={<Navigate to="/csp/login" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
