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

  useEffect(() => { void load(); }, []);

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

  const defaultMethod = methods.find((method) => method.isDefault) ?? methods[0] ?? null;

  return (
    <div className="text-[#0B1220] pb-4">
      <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3 h-3" />} className="mb-4 !px-0 text-[#667085]" onClick={() => navigate(profilePath)}>Back</Button>

      <header className="mb-5">
        <h1 className="text-xl font-semibold">Payment methods</h1>
        <p className="mt-1 text-sm text-[#667085]">Choose the card Cleanr should use for future bookings.</p>
      </header>

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="py-5 text-sm text-[#667085]">Loading payment methods…</p>
      ) : defaultMethod ? (
        <section className="mb-5 border-y border-[#E4E7EC] py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Default card</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3FAF1] text-[#166534]"><CreditCard className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{defaultMethod.label}</p>
              <p className="mt-0.5 text-sm text-[#475467]">{brandLabel(defaultMethod.brand)} •••• {defaultMethod.last4}</p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-[#8DCC64]" />
          </div>
        </section>
      ) : (
        <section className="mb-5 border-y border-[#E4E7EC] py-5">
          <p className="text-sm font-semibold">No saved card yet</p>
          <p className="mt-1 text-sm text-[#667085]">Add a card now or when you make your next booking.</p>
        </section>
      )}

      <Button variant="primaryBlue" size="lg" fullWidth leftIcon={<Plus className="h-4 w-4" />} onClick={() => void addCard()} disabled={adding} loading={adding}>
        {adding ? "Opening secure setup…" : "Add payment method"}
      </Button>

      {!loading && methods.length > 0 ? (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Saved cards</h2>
            <span className="text-xs text-[#98A2B3]">{methods.length}</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white">
            {methods.map((method, index) => (
              <div key={method.id} className={`px-4 py-4 ${index > 0 ? "border-t border-[#E4E7EC]" : ""}`}>
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-[#667085]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" className="text-left text-sm font-semibold underline-offset-2 hover:underline" onClick={() => void rename(method)}>{method.label}</button>
                      {method.isDefault ? <span className="rounded-full bg-[#ECFDF3] px-2 py-0.5 text-[10px] font-semibold text-[#027A48]">Default</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-[#475467]">{brandLabel(method.brand)} •••• {method.last4}{method.expMonth && method.expYear ? ` · ${String(method.expMonth).padStart(2, "0")}/${String(method.expYear).slice(-2)}` : ""}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 pl-7">
                  {!method.isDefault ? (
                    <button type="button" disabled={busyId === method.id} onClick={() => void makeDefault(method)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#475467] disabled:opacity-50"><Star className="h-3.5 w-3.5" /> Make default</button>
                  ) : null}
                  <button type="button" disabled={busyId === method.id} onClick={() => void remove(method)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B42318] disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <details className="mt-6 border-t border-[#E4E7EC] pt-4">
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#667085]"><ShieldCheck className="h-4 w-4" /> How card security works</summary>
        <p className="mt-2 text-xs leading-5 text-[#667085]">Stripe securely stores your payment details. Cleanr only receives the card brand, last four digits, expiration, and related payment identifiers—not the full card number or security code.</p>
      </details>

      <Button className="mt-5" variant="secondary" size="lg" fullWidth onClick={() => navigate(profilePath)}>Done</Button>
    </div>
  );
}
