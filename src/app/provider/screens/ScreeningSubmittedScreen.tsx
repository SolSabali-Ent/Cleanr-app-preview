import { useNavigate } from "react-router-dom";
import {
  CSP_PRIMARY_BUTTON,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

const APPLICATION_STATUS = "/csp/dashboard/application-status";
const APPLICATION_CHECKLIST = "/csp/dashboard/application";

export default function ScreeningSubmittedScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen px-4 py-8" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <h1 className="text-2xl font-semibold">Screening Submitted</h1>
        <p className="text-sm mt-2" style={{ color: CSP_TEXT_SECONDARY }}>
          Your screening has been submitted for review. We&apos;ll notify you when the next step is
          available or if we need additional information.
        </p>
      </header>

      <p className="text-sm mb-6" style={{ color: CSP_TEXT_SECONDARY }}>
        You can continue reviewing your application progress while this step is under review.
      </p>

      <div className="grid gap-3">
        <button
          type="button"
          onClick={() => navigate(APPLICATION_STATUS)}
          className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-90 active:opacity-85"
          style={{ backgroundColor: CSP_PRIMARY_BUTTON }}
        >
          View Status
        </button>
        <button
          type="button"
          onClick={() => navigate(APPLICATION_CHECKLIST)}
          className="w-full py-3 rounded-xl text-sm font-medium border"
          style={{ borderColor: "rgba(248, 250, 252, 0.12)", color: CSP_TEXT_SECONDARY }}
        >
          Back to Application
        </button>
      </div>
    </div>
  );
}
