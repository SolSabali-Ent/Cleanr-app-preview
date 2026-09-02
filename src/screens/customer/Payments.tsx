import { ArrowLeft, CreditCard } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { customerRouteForContext } from "../../lib/contextualRoutes";

/** Customer payment surface. Stripe-backed management is intentionally deferred until checkout is configured. */
export function Payments() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const profilePath = customerRouteForContext(pathname, "/app/profile");

  return (
    <div className="text-[#0B1220]">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3 h-3" />} className="mb-4 !px-0 text-[#667085]" onClick={() => navigate(profilePath)}>
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
      <Button className="mt-4" variant="secondary" size="lg" fullWidth onClick={() => navigate(profilePath)}>
        Done
      </Button>
    </div>
  );
}
