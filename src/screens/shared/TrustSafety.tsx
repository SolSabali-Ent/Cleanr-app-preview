import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/Button";

export function TrustSafety() {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/app/bookings");
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="w-3 h-3" />}
          className="mb-4 !px-0 text-[#667085]"
          onClick={handleBack}
        >
          Back
        </Button>
        <h1 className="text-3xl font-semibold">Trust &amp; Safety</h1>
        <p className="mt-3 text-slate-600">
          Cleanr helps keep bookings transparent with verified provider profiles, documented job
          activity, and support for disputes.
        </p>

        <section className="mt-8 space-y-4 text-sm leading-6 text-slate-700">
          <p>Provider profiles include trust signals so you can book with confidence.</p>
          <p>Booking updates and job activity are tracked in-app for clear timelines.</p>
          <p>Support is available when a booking needs review or dispute help.</p>
        </section>

        <section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-medium text-slate-800">Important notice</p>
          <p className="mt-2">
            Cleanr providers are independent professionals. Platform protections help support fair
            review and resolution.
          </p>
        </section>
      </main>
    </div>
  );
}

