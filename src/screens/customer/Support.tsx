import { ArrowLeft, CalendarDays, ShieldCheck, MessageCircleQuestion } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";

export function Support() {
  const navigate = useNavigate();

  return (
    <div className="text-[#0B1220]">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3 h-3" />} className="mb-4 !px-0 text-[#667085]" onClick={() => navigate("/app/profile")}>
        Back
      </Button>
      <h1 className="text-xl font-semibold mb-2">Help &amp; safety</h1>
      <p className="mb-4 text-sm text-[#667085]">Start with the part of Cleanr connected to the issue.</p>

      <div className="space-y-3">
        <div className="provider-card space-y-3">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#8DCC64]" />
            <div>
              <p className="text-sm font-medium">Booking help</p>
              <p className="mt-1 text-sm text-[#667085]">Open the booking for service details, status, and booking-specific communication.</p>
            </div>
          </div>
          <Button variant="primaryBlue" size="md" fullWidth onClick={() => navigate("/app/bookings")}>
            View my bookings
          </Button>
        </div>

        <div className="provider-card space-y-3">
          <div className="flex items-start gap-3">
            <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-[#8DCC64]" />
            <div>
              <p className="text-sm font-medium">Urgent issue during a cleaning</p>
              <p className="mt-1 text-sm text-[#667085]">Use the urgent booking help path for an issue tied to an active service.</p>
            </div>
          </div>
          <Button variant="secondary" size="md" fullWidth onClick={() => navigate("/app/emergency")}>
            Open urgent booking help
          </Button>
        </div>

        <div className="provider-card space-y-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#8DCC64]" />
            <div>
              <p className="text-sm font-medium">Trust &amp; Safety</p>
              <p className="mt-1 text-sm text-[#667085]">Review Cleanr&apos;s safety guidance and marketplace expectations.</p>
            </div>
          </div>
          <Button variant="secondary" size="md" fullWidth onClick={() => navigate("/trust-safety")}>
            View Trust &amp; Safety
          </Button>
        </div>
      </div>

      <Button className="mt-4" variant="secondary" size="lg" fullWidth onClick={() => navigate("/app/profile")}>
        Done
      </Button>
    </div>
  );
}
