import { ArrowLeft, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";

export function Addresses() {
  const navigate = useNavigate();

  return (
    <div className="text-[#0B1220]">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3 h-3" />} className="mb-4 !px-0 text-[#667085]" onClick={() => navigate("/app/profile")}>
        Back
      </Button>
      <h1 className="text-xl font-semibold mb-2">Service addresses</h1>
      <div className="provider-card space-y-3">
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#8DCC64]" />
          <div>
            <p className="text-sm font-medium">Addresses are currently booking-based</p>
            <p className="mt-1 text-sm text-[#667085]">
              The service location you enter is stored with that booking. A separate saved-address book is not enabled yet.
            </p>
          </div>
        </div>
        <Button variant="primaryBlue" size="md" fullWidth onClick={() => navigate("/app/bookings")}>
          View my bookings
        </Button>
      </div>
      <Button className="mt-4" variant="secondary" size="lg" fullWidth onClick={() => navigate("/app/profile")}>
        Done
      </Button>
    </div>
  );
}
