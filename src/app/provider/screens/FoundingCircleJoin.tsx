import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
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

  const ratePercent = pilotRate == null ? null : Math.round(pilotRate * 100);
  const rateLabel = ratePercent == null ? "Current pilot rate" : `${ratePercent}%`;

  const startSetup = () => navigate("/csp/signup?source=founding_circle");

  return (
    <main className="min-h-screen bg-white text-[#0B1220]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[113px] max-w-6xl items-center justify-between gap-5 px-5 sm:px-8">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex h-[73px] w-[73px] shrink-0 items-center text-left"
            aria-label="Cleanr home"
          >
            <img
              src="/cleanr-app@2x.png"
              alt="Cleanr"
              className="h-[73px] w-[73px] origin-left scale-[2] rounded-2xl object-contain"
            />
          </button>
          <button
            type="button"
            onClick={() => navigate("/csp/login")}
            className="relative z-10 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-[#0B1220]"
          >
            Provider sign in
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <section className="px-5 pb-16 pt-14 sm:px-8 sm:pb-20 sm:pt-20">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.28fr_0.72fr] lg:items-end lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0000FE]">Founding Circle · Metro Atlanta</p>
            <h1 className="mt-5 max-w-[13ch] text-4xl font-bold leading-[1.02] tracking-[-0.035em] sm:text-5xl lg:text-[64px]">
              Bring the relationships you already built.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              Keep serving the households who already trust you. Cleanr adds the scheduling, payments, continuity, coverage, and support around the relationship.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={startSetup}
                className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#0000FE] px-7 py-4 text-base font-semibold text-white transition hover:opacity-95 active:scale-[0.99]"
              >
                Start provider setup
                <ArrowRight className="h-4 w-4" />
              </button>
              <span className="text-sm text-slate-500">Existing clients are helpful, not required.</span>
            </div>
          </div>

          <aside className="border-t border-slate-200 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pilot economics</p>
            <p className="mt-3 text-5xl font-semibold tracking-[-0.04em] text-[#0B1220]">{rateLabel}</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
              {ratePercent == null
                ? "Provider-brought relationships use the current Founding Circle pilot platform rate."
                : `For paid bookings that continue a provider-brought relationship, Cleanr currently uses a ${ratePercent}% platform fee.`}
              {" "}The customer still pays the normal service price.
            </p>
          </aside>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-[#F8FAFC] px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#166534]">What stays yours</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.025em] sm:text-4xl">The relationship stays human. Cleanr supports the infrastructure.</h2>
          </div>

          <div className="mt-10 border-y border-slate-200">
            {[
              {
                number: "01",
                title: "Bring existing households",
                body: "After approval, you can invite households you already serve into Cleanr. Their relationship with you is recorded as provider-brought and remains distinct from open-market matching.",
              },
              {
                number: "02",
                title: "No artificial lock-in",
                body: "Cleanr handles scheduling, payments, continuity, protection, coverage, and relationship memory. The relationship is not treated as something the platform owns.",
              },
              {
                number: "03",
                title: "Same provider standards",
                body: "Founding Circle recruitment does not improve your approval score or bypass verification, payout readiness, marketplace eligibility, or service requirements.",
              },
            ].map((item, index) => (
              <div
                key={item.number}
                className={`grid gap-4 py-7 sm:grid-cols-[72px_0.8fr_1.2fr] sm:items-start sm:gap-8 ${index > 0 ? "border-t border-slate-200" : ""}`}
              >
                <p className="text-sm font-semibold text-slate-400">{item.number}</p>
                <h3 className="text-lg font-semibold tracking-tight text-[#0B1220]">{item.title}</h3>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-6xl bg-[#0B1220] px-6 py-10 text-white sm:px-10 sm:py-12 lg:grid lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8DCC64]">What we&apos;re testing together</p>
            <h2 className="mt-3 text-3xl font-bold tracking-[-0.025em]">Can a local network create more stability than going it alone?</h2>
          </div>
          <p className="mt-6 text-base leading-7 text-slate-300 lg:mt-0 lg:self-end">
            Reliable recurring service, trusted handoffs when coverage is needed, better household continuity, and whether a small local network can create more opportunity and stability than each person operating alone.
          </p>
        </div>
      </section>

      <section className="border-t border-slate-200 px-5 py-14 sm:px-8 sm:py-18">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">One important note</p>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.02em] sm:text-3xl">You do not need existing clients to apply.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Existing households simply let us test relationship continuity sooner. They are not a quality score and are not required for provider approval.
            </p>
          </div>
          <button
            type="button"
            onClick={startSetup}
            className="inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#0000FE] px-7 py-4 text-base font-semibold text-white transition hover:opacity-95 active:scale-[0.99] sm:w-auto"
          >
            Start Founding Circle setup
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-xs text-slate-400">Residential-first pilot · Metro Atlanta · independent service providers</p>
      </section>
    </main>
  );
}
