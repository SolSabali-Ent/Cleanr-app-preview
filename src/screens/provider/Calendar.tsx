import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import CalendarScreen from "../../app/provider/screens/CalendarScreen";
import { Button } from "../../components/ui/Button";

export function Calendar() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAvailability = searchParams.get("tab") === "availability";

  const leaveCalendar = () => {
    navigate("/csp/dashboard", { replace: true });
  };

  return (
    <>
      {isAvailability ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft className="h-3 w-3" />}
            className="!px-0 text-slate-300"
            onClick={leaveCalendar}
          >
            Back
          </Button>
          <Button variant="secondary" size="sm" onClick={leaveCalendar}>
            Done
          </Button>
        </div>
      ) : null}
      <CalendarScreen />
    </>
  );
}
