import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, CreditCard, Plus, ShieldCheck, Star, Trash2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { customerRouteForContext } from "../../lib/contextualRoutes";
import {
  createPaymentMethodSetupUrl,
  listMyPaymentMethods,
  removePaymentMethod,
  renamePaymentMethod,
  setDefaultPaymentMethod,
  type CustomerPaymentMethod,
} from "../../lib/customerPaymentMethodsApi";

function brandLabel(value: string): string {
  const brand = value.toLowerCase();
  if (brand === "visa") return "Visa";
  if (brand === "mastercard") return "Mastercard";
  if (brand === "amex") return "Amex";
  if (brand === "discover") return "Discover";
  return "Card";
}

export function Payments() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const profilePath = customerRouteForContext(pathname, "/app/profile");
  const paymentsPath = customerRouteForContext(pathname, "/app/payments");
  const [methods, setMethods] = useState<CustomerPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setMethods(await listMyPaymentMethods());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load saved cards.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addCard() {
    if (adding) return;
    setAdding(true);
    setError(null);
    try {
      const returnUrl = `${window.location.origin}${paymentsPath}`;
      const url = await createPaymentMethodSetupUrl(returnUrl);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add a card right now.");
      setAdding(false);
    }
  }

  async function rename(method: CustomerPaymentMethod) {
    const next = window.prompt("Name this card", method.label)?.trim();
    if (!next || next === method.label) return;
    setBusyId(method.id);
    setError(null);
    try {
      await renamePaymentMethod(method.id, next);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to rename this card.");
    } finally {
      setBusyId(null);
    }
  }

  async function makeDefault(method: CustomerPaymentMethod) {
    if (method.isDefault) return;
    setBusyId(method.id);
    setError(null);
    try {
      await setDefaultPaymentMethod(method.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change your default card.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(method: CustomerPaymentMethod) {
    if (!window.confirm(`Remove ${method.label}?`)) return;
    setBusyId(method.id);
    setError(null);
    try {
      await removePaymentMethod(method.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove this card.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="text-[#0B1220] pb-4">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<ArrowLeft className="w-3 h-3" />}
        className="mb-4 !px-0 text-[#667085]"
        onClick={() => navigate(profilePath)}
      >
        Back
      </Button>

      <header className="mb-5">
        <h1 className="text-xl font-semibold">Payment methods</h1>
        <p className="mt-1 text-sm text-[#667085]">Cards you can use for Cleanr bookings.</p>
      </header>

      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[#DCEED7] bg-[#F6FBF4] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#166534]" />
        <div>
          <p className="text-sm font-medium text-[#166534]">Stored securely with Stripe</p>
          <p className="mt-1 text-xs leading-5 text-[#667085]">
            Cleanr only shows the card brand, last four digits, and expiration date. Full card numbers and security codes are never stored in Cleanr.
          </p>
        </div>
      </div>

      <Button
        variant="primaryBlue"
        size="lg"
        fullWidth
        leftIcon={<Plus className="h-4 w-4" />}
        onClick={() => void addCard()}
        disabled={adding}
        loading={adding}
      >
        {adding ? "Opening secure setup…" : "Add payment method"}
      </Button>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#667085]">Saved cards</h2>
          {!loading && methods.length > 0 ? <span className="text-xs text-[#98A2B3]">{methods.length}</span> : null}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
            <p className="text-sm text-[#667085]">Loading payment methods…</p>
          </div>
        ) : methods.length === 0 ? (
          <div className="rounded-2xl border border-[#E4E7EC] bg-white p-5">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-[#8DCC64]" />
              <div>
                <p className="text-sm font-semibold">No saved cards yet</p>
                <p className="mt-1 text-sm text-[#667085]">Add one when you&apos;re ready. You can keep more than one card.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {methods.map((method) => (
              <div key={method.id} className="rounded-2xl border border-[#E4E7EC] bg-white p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3FAF1] text-[#166534]">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="text-left text-sm font-semibold underline-offset-2 hover:underline" onClick={() => void rename(method)}>
                        {method.label}
                      </button>
                      {method.isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10px] font-semibold text-[#027A48]">
                          <CheckCircle2 className="h-3 w-3" /> Default
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[#475467]">{brandLabel(method.brand)} •••• {method.last4}</p>
                    {method.expMonth && method.expYear ? (
                      <p className="mt-0.5 text-xs text-[#98A2B3]">Expires {String(method.expMonth).padStart(2, "0")}/{String(method.expYear).slice(-2)}</p>
                    ) : null}
                    {method.cardholderName ? <p className="mt-0.5 text-xs text-[#98A2B3]">{method.cardholderName}</p> : null}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  {!method.isDefault ? (
                    <button
                      type="button"
                      disabled={busyId === method.id}
                      onClick={() => void makeDefault(method)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#D0D5DD] px-3 py-2.5 text-xs font-semibold text-[#475467] disabled:opacity-50"
                    >
                      <Star className="h-3.5 w-3.5" /> Make default
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyId === method.id}
                    onClick={() => void remove(method)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#FECACA] px-3 py-2.5 text-xs font-semibold text-[#B42318] disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Button className="mt-5" variant="secondary" size="lg" fullWidth onClick={() => navigate(profilePath)}>
        Done
      </Button>
    </div>
  );
}
