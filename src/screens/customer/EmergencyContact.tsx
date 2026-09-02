import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";

export function EmergencyContact() {
  const navigate = useNavigate();

  return (
    <div className="text-[#0B1220]">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3 h-3" />} className="mb-4 !px-0 text-[#667085]" onClick={() => navigate("/app/profile")}>
        Back
      </Button>
      <h1 className="text-xl font-semibold mb-2">Emergency contact</h1>
      <div className="provider-card space-y-3">
        <p className="text-sm text-[#667085]">Use this area for urgent cleaning-related support. If anyone is in immediate danger, contact local emergency services.</p>
        <Button variant="secondary" size="md" fullWidth onClick={() => navigate("/trust-safety")}>
          View Trust &amp; Safety
        </Button>
      </div>
      <Button className="mt-4" variant="secondary" size="lg" fullWidth onClick={() => navigate("/app/profile")}>
        Done
      </Button>
    </div>
  );
}
