import { ArrowLeft, MessageCircle, ShieldAlert } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { customerRouteForContext } from "../../lib/contextualRoutes";

export function EmergencyContact() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const route = (canonicalPath: string) => customerRouteForContext(pathname, canonicalPath);

  return (
    <div className="text-[#0B1220]">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="w-3 h-3" />}
        className="mb-4 !px-0 text-[#667085]"
        onClick={() => navigate(route("/app/profile"))}
      >
        Back
      </Button>

      <h1 className="text-xl font-semibold mb-2">Urgent booking help</h1>
      <div className="provider-card space-y-3">
        <p className="text-sm text-[#667085]">
          For an urgent issue tied to an active cleaning, open the booking and message your CSP from the booking thread.
          If anyone is in immediate danger, contact local emergency services.
        </p>

        <Button
          variant="primaryBlue"
          size="md"
          fullWidth
          leftIcon={<MessageCircle className="w-4 h-4" />}
          onClick={() => navigate(route("/app/bookings"))}
        >
          Go to my bookings
        </Button>

        <Button
          variant="secondary"
          size="md"
          fullWidth
          leftIcon={<ShieldAlert className="w-4 h-4" />}
          onClick={() => navigate("/trust-safety")}
        >
          Trust &amp; Safety information
        </Button>
      </div>

      <Button className="mt-4" variant="secondary" size="lg" fullWidth onClick={() => navigate(route("/app/profile"))}>
        Done
      </Button>
    </div>
  );
}
