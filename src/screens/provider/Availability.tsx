import { ArrowLeft, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";

/** Provider: set availability. Shared domain (schedule), provider view. */
export function Availability() {
  const navigate = useNavigate();

  const leaveAvailability = () => {
    navigate("/csp/dashboard", { replace: true });
  };

  return (
    <div className="text-white">
      <button
        type="button"
        onClick={leaveAvailability}
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <h1 className="text-xl font-semibold mb-2">Availability</h1>
      <p className="text-sm text-slate-400">Set your available hours — coming soon.</p>

      <Button
        className="mt-6"
        variant="primaryBlue"
        size="lg"
        fullWidth
        leftIcon={<Check className="h-4 w-4" />}
        onClick={leaveAvailability}
      >
        Done
      </Button>
    </div>
  );
}
