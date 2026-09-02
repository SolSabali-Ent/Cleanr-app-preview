import { ArrowLeft, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";

/** Customer payment surface. Stripe-backed management is intentionally deferred until checkout is configured. */
export function Payments() {
  const navigate = useNavigate();

  return (
    <div className="text-[#0B1220]">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3 h-3" />} className="mb-4 !px-0 text-[#667085]" onClick={() => navigate("/app/profile")}>
        Back
      </Button>
      <h1 className="text-xl font-semibold mb-2">Payments</h1>
      <div className="provider-card space-y-3">
        <div className="flex items-start gap-3">
          <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#8DCC64]" />
          <div>
            <p className="text-sm font-medium">Payment management is not active yet</p>
            <p className="mt-1 text-sm text-[#667085]">
              Cleanr will add saved payment methods and payment history here when checkout and Stripe payment processing are enabled.
            </p>
          </div>
        </div>
      </div>
      <Button className="mt-4" variant="secondary" size="lg" fullWidth onClick={() => navigate("/app/profile")}>
        Done
      </Button>
    </div>
  );
}
