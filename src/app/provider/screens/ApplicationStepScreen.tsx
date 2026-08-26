import { Navigate, useParams } from "react-router-dom";
import AgreementScreen from "./AgreementScreen";
import UploadInsuranceScreen from "./UploadInsuranceScreen";
import IdentityScreen from "./IdentityScreen";
import BackgroundCheckScreen from "./BackgroundCheckScreen";
import ScreeningScreen from "./ScreeningScreen";
import ScreeningSubmittedScreen from "./ScreeningSubmittedScreen";
import TransportationReadinessScreen from "./TransportationReadinessScreen";
import PayoutSetupScreen from "./PayoutSetupScreen";

export default function ApplicationStepScreen() {
  const { step } = useParams<{ step: string }>();
  if (step === "agreement") return <AgreementScreen />;
  if (step === "insurance") return <UploadInsuranceScreen />;
  if (step === "identity") return <IdentityScreen />;
  if (step === "background") return <BackgroundCheckScreen />;
  if (step === "screening") return <ScreeningScreen />;
  if (step === "screening-submitted") return <ScreeningSubmittedScreen />;
  if (step === "transportation") return <TransportationReadinessScreen />;
  if (step === "payout-setup") return <PayoutSetupScreen />;
  return <Navigate to="/csp/dashboard/application" replace />;
}
