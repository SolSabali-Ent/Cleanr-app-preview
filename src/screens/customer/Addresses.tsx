import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { customerRouteForContext } from "../../lib/contextualRoutes";
import {
  listMyVerifiedServiceAddresses,
  type CustomerServiceAddress,
} from "../../lib/customerServiceAddressApi";

function formatLastUsed(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

export function Addresses() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const route = (canonicalPath: string) => customerRouteForContext(pathname, canonicalPath);
  const [addresses, setAddresses] = useState<CustomerServiceAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listMyVerifiedServiceAddresses()
      .then((rows) => {
        if (active) setAddresses(rows);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load your service addresses.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="text-[#0B1220] pb-4">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="w-3 h-3" />}
        className="mb-4 !px-0 text-[#667085]"
        onClick={() => navigate(route("/app/profile"))}
      >
        Back
      </Button>

      <header className="mb-5">
        <h1 className="text-xl font-semibold">Service addresses</h1>
        <p className="mt-1 text-sm text-[#667085]">
          Verified homes you&apos;ve booked with Cleanr.
        </p>
      </header>

      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#DCEED7] bg-[#F6FBF4] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#166534]" />
        <div>
          <p className="text-sm font-medium text-[#166534]">Kept private</p>
          <p className="mt-1 text-xs leading-5 text-[#667085]">
            Your saved address list is visible only in your account. Cleanr does not show saved coordinates or entry instructions here.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
          <p className="text-sm text-[#667085]">Loading your addresses...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : addresses.length === 0 ? (
        <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#8DCC64]" />
            <div>
              <p className="text-sm font-semibold">No saved service address yet</p>
              <p className="mt-1 text-sm text-[#667085]">
                A verified address will appear here after you complete a paid booking.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((address, index) => (
            <div key={address.key} className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3FAF1] text-[#166534]">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{index === 0 ? "Most recent" : "Saved address"}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10px] font-semibold text-[#027A48]">
                      <CheckCircle2 className="h-3 w-3" /> Verified
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{address.line1}</p>
                  {address.line2 ? <p className="mt-0.5 text-sm text-[#667085]">{address.line2}</p> : null}
                  <p className="mt-2 text-[11px] text-[#98A2B3]">Last used {formatLastUsed(address.lastUsedAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        className="mt-5"
        variant="secondary"
        size="lg"
        fullWidth
        onClick={() => navigate(route("/app/profile"))}
      >
        Done
      </Button>
    </div>
  );
}
