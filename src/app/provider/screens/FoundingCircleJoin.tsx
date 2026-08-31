import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../../lib/supabase";

export default function FoundingCircleJoin() {
  const navigate = useNavigate();
  const [pilotRate, setPilotRate] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "provider_brought_platform_fee_rate")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const parsed = Number((data as { value?: string } | null)?.value);
        setPilotRate(Number.isFinite(parsed) ? parsed : null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rateLabel = pilotRate == null ? "the current provider-brought pilot rate" : `${Math.round(pilotRate * 100)}%`;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <img src="/cleanr-app@2x.png" alt="Cleanr" className="h-12 w-12 object-contain" />
          <button type="button" onClick={() => navigate("/csp/login")} className="text-sm font-medium text-[#0A84FF]">
            Already a provider? Sign in
          </button>
        </div>

        <section className="mt-12">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#0A84FF]">Founding Circle · Metro Atlanta</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight">Bring the relationships you already built. Let Cleanr support the work around them.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            We&apos;re inviting a small first group of residential cleaning service providers to help us build Cleanr around continuity, trust, and stronger local relationships—not just one-off job matching.
          </p>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold">If you already have clients</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              After approval, you can invite households you already serve into Cleanr. Their relationship with you is recorded as provider-brought and stays distinct from open-market matching.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold">Pilot economics</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              For paid bookings that continue a provider-brought relationship, Cleanr currently uses a {rateLabel} platform fee. The customer still pays the normal service price.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold">No artificial lock-in</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Cleanr is here to handle scheduling, payments, continuity, protection, coverage, and relationship memory. The relationship is not treated as something the platform owns.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold">Same provider standards</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Founding Circle recruitment does not improve your approval score or bypass verification, payout readiness, marketplace eligibility, or service requirements.
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl bg-slate-900 p-6 text-white">
          <h2 className="text-xl font-semibold">What we&apos;re testing together</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Reliable recurring service, trusted handoffs when coverage is needed, better household continuity, and whether a small local network can create more opportunity and stability than each person operating alone.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-semibold">You do not need existing clients to apply.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Existing households simply let us test relationship continuity sooner. They are not a quality score and are not required for provider approval.
          </p>
          <button
            type="button"
            onClick={() => navigate("/csp/signup?source=founding_circle")}
            className="mt-6 w-full rounded-2xl bg-[#0A84FF] px-6 py-4 text-base font-semibold text-white shadow-md shadow-[#0A84FF]/30 transition hover:opacity-95 active:scale-[0.99]"
          >
            Start Founding Circle provider setup →
          </button>
          <p className="mt-3 text-center text-xs text-slate-500">Residential-first pilot · Metro Atlanta · independent service providers</p>
        </section>
      </div>
    </main>
  );
}
