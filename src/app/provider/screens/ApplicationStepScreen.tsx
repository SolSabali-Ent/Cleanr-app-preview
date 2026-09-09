import { Navigate, useParams } from "react-router-dom";
import CSPTermsScreen from "./CSPTermsScreen";
import UploadInsuranceScreen from "./UploadInsuranceScreen";
import IdentityScreen from "./IdentityScreen";
import BackgroundCheckScreen from "./BackgroundCheckScreen";
import ScreeningScreen from "./ScreeningScreen";
import ScreeningSubmittedScreen from "./ScreeningSubmittedScreen";
import TransportationReadinessScreen from "./TransportationReadinessScreen";
import PayoutSetupScreen from "./PayoutSetupScreen";

export default function ApplicationStepScreen() {
  const { step } = useParams<{ step: string }>();

  // Historical /application/agreement links resolve to the same canonical,
  // versioned CSP Terms surface. Do not maintain a second acceptance path.
  if (step === "agreement") return <CSPTermsScreen />;
  if (step === "insurance") return <UploadInsuranceScreen />;
  if (step === "identity") return <IdentityScreen />;
  if (step === "background") return <BackgroundCheckScreen />;
  if (step === "screening") return <ScreeningScreen />;
  if (step === "screening-submitted") return <ScreeningSubmittedScreen />;
  if (step === "transportation") return <TransportationReadinessScreen />;
  if (step === "payout-setup") return <PayoutSetupScreen />;
  return <Navigate to="/csp/dashboard/application" replace />;
}
