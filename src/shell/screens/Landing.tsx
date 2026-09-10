import { useEffect, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { captureReferralCodeFromUrl } from "../../lib/referralRef";
import { CUSTOMER_ENTRY_PATH, FOUNDING_CIRCLE_ENTRY_PATH, LOGIN_PATH } from "../../lib/entryRoutes";
import {
  cleanrBrand,
  LANDING_LOGO_FOOTER_CLASS,
  LANDING_LOGO_HERO_CLASS,
  LANDING_LOGO_HERO_SRC,
  LANDING_LOGO_SRC,
} from "../../lib/brand";
import { PublicProviderShowcase } from "../components/PublicProviderShowcase";
import { PublicFaq } from "../components/PublicFaq";

const c = cleanrBrand.color;

function HeroPrimaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-lg px-8 py-4 text-center font-medium shadow-lg transition-colors sm:w-auto"
      style={{ backgroundColor: c.primary, color: c.primaryOnDark }}
    >
      {children}
    </Link>
  );
}

function HeroSecondaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="flex min-h-[3rem] w-full items-center justify-center rounded-lg border border-white/30 bg-white/10 px-8 py-4 text-center font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/15 sm:w-auto"
    >
      {children}
    </Link>
  );
}

function BluePrimaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-lg bg-[#0000FE] px-8 py-4 text-center font-medium text-white transition-opacity hover:opacity-90"
    >
      {children}
    </Link>
  );
}

export default function Landing() {
  useEffect(() => {
    captureReferralCodeFromUrl();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <section className="relative min-h-[100svh] overflow-hidden text-white" style={{ backgroundColor: c.heroBg }}>
        <video autoPlay muted loop playsInline preload="metadata" poster="/media/hero-cleaning-poster.jpg" aria-hidden="true" tabIndex={-1} className="absolute inset-0 h-full w-full object-cover object-top">
          <source src="/media/cleanr-hero.mp4" type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute inset-0 bg-[#071A2F]/45" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-[#071A2F]/20 to-[#071A2F]/65" />

        <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-7xl flex-col px-6 pb-10 pt-8 sm:pb-12 lg:pt-10">
          <div className="flex min-w-0 items-start justify-between gap-3 md:items-center md:gap-4">
            <Link to="/" className="block min-w-0 shrink sm:max-w-none" aria-label="Cleanr home">
              <img src={LANDING_LOGO_HERO_SRC} alt="Cleanr" width={906} height={209} loading="eager" decoding="async" className={LANDING_LOGO_HERO_CLASS} />
            </Link>
            <nav className="mt-0.5 flex shrink-0 items-center justify-end gap-1 sm:gap-2" aria-label="Public navigation">
              <Link to={FOUNDING_CIRCLE_ENTRY_PATH} className="inline-flex min-h-11 items-center justify-center px-2 py-2 text-[11px] font-semibold text-white transition-colors hover:text-white sm:px-3 sm:text-sm">Founding Circle</Link>
              <a href="#meet-cleanr-csps" className="hidden min-h-11 items-center justify-center px-3 py-2 text-xs font-medium text-white/90 transition-colors hover:text-white md:inline-flex md:text-sm">Meet CSPs</a>
              <a href="#faq" className="hidden min-h-11 items-center justify-center px-3 py-2 text-xs font-medium text-white/90 transition-colors hover:text-white sm:inline-flex sm:text-sm">FAQ</a>
              <Link to={LOGIN_PATH} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-white/45 bg-black/10 px-3 py-2 text-xs font-medium text-white backdrop-blur-md sm:text-sm">Log in</Link>
            </nav>
          </div>

          <div className="flex flex-1 items-center py-10 sm:py-14 lg:py-16">
            <div className="max-w-3xl">
              <h1 className="max-w-[12ch] text-[44px] font-bold leading-[0.98] text-white drop-shadow-lg sm:text-5xl lg:text-7xl lg:leading-[0.93]">A cleaner home,<br />without the back-and-forth.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-[1.55] text-white/95 drop-shadow-md sm:text-xl md:mt-8 md:text-2xl">Book trusted home cleaning with a simple, clear experience.</p>
              <div className="mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row">
                <HeroPrimaryLink to={CUSTOMER_ENTRY_PATH}>Book a clean <ArrowRight className="h-4 w-4" /></HeroPrimaryLink>
                <HeroSecondaryLink to={FOUNDING_CIRCLE_ENTRY_PATH}>Earn with Cleanr</HeroSecondaryLink>
              </div>
              <p className="mt-4 text-sm text-white/75">Independent providers in Metro Atlanta can join the Founding Circle, including people who already have clients.</p>
            </div>
          </div>
        </div>
      </section>

      <PublicProviderShowcase />

      <section className="bg-white px-6 py-16 sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#166534]">Founding Circle · Metro Atlanta</p>
            <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight text-[#0B1220] sm:text-4xl">Grow the work without giving up the relationship.</h2>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-[#667085]">The Founding Circle is for Cleanr&apos;s first group of providers. Bring households who already trust you, or join without existing clients, and help shape what we build.</p>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <BluePrimaryLink to={FOUNDING_CIRCLE_ENTRY_PATH}>Explore the Founding Circle <ArrowRight className="h-4 w-4" /></BluePrimaryLink>
              <Link to="/csp/signup" className="inline-flex min-h-12 items-center px-2 text-sm font-semibold text-[#0000FE]">Apply now</Link>
            </div>
          </div>

          <div className="border-y border-slate-200">
            {[
              ["01", "Bring relationships you already have", "If you already serve households, Cleanr keeps track that the relationship started with you and adds scheduling, payments, and support."],
              ["02", "Choose new jobs that fit", "Set when and where you want to work, then choose which new Cleanr jobs make sense for you. You are not forced to accept jobs."],
              ["03", "Build toward what comes next", "A strong cleaning business can be the goal. Or it can help you move toward mentoring, owning a business, school, another career, or other goals."],
            ].map(([number, title, body]) => (
              <div key={number} className="grid gap-3 border-b border-slate-200 py-7 last:border-b-0 sm:grid-cols-[72px_1fr] sm:gap-6">
                <p className="text-2xl font-semibold tracking-tight text-slate-300">{number}</p>
                <div><h3 className="text-lg font-semibold text-[#0B1220]">{title}</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[#667085]">{body}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0B1220] px-6 py-16 text-white sm:py-24">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1fr] lg:items-end lg:gap-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#8DCC64]">Built for repeat trust</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">Choose who cleans your home. Keep the connection when it works.</h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/70">Cleanr handles the busywork around each visit so a good relationship can keep growing.</p>
          </div>
          <div className="divide-y divide-white/15 border-y border-white/15">
            {[
              ["Know who you're booking", "See real CSP profiles before you choose who may come into your home."],
              ["Keep a good match", "When things work well, your past visits and home preferences stay connected."],
              ["Let Cleanr handle the busywork", "Scheduling, payments, updates, and support stay organized around the relationship."],
            ].map(([title, body]) => (
              <div key={title} className="py-5"><p className="font-semibold text-white">{title}</p><p className="mt-1 text-sm leading-6 text-white/60">{body}</p></div>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:col-span-2">
            <Link to={CUSTOMER_ENTRY_PATH} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#0000FE] px-7 py-3 font-medium text-white">Book now <ArrowRight className="h-4 w-4" /></Link>
            <a href="#meet-cleanr-csps" className="inline-flex min-h-12 items-center justify-center border-b border-white/40 px-2 font-medium text-white">Meet CSPs</a>
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl border-y border-slate-200 py-10">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
            <div><p className="text-sm font-semibold uppercase tracking-wide text-[#166534]">Home cleaning</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-[#0B1220]">Cleaning options</h2></div>
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {["Standard clean", "Deep clean", "Move-out clean", "Repeat cleaning", "Home reset"].map((label) => <p key={label} className="border-b border-slate-200 pb-3 text-sm font-medium text-[#0B1220]">{label}</p>)}
            </div>
          </div>
        </div>
      </section>

      <PublicFaq />

      <section className="px-6 py-16 sm:py-24" style={{ backgroundColor: c.heroBg }}>
        <div className="mx-auto max-w-3xl text-center text-white">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready for a cleaner home?</h2>
          <p className="mt-4 text-lg leading-relaxed text-white/85">Start your booking, choose a CSP if you want one, and keep moving.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <HeroPrimaryLink to={CUSTOMER_ENTRY_PATH}>Book a clean <ArrowRight className="h-4 w-4" /></HeroPrimaryLink>
            <HeroSecondaryLink to={FOUNDING_CIRCLE_ENTRY_PATH}>Join the Founding Circle</HeroSecondaryLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <Link to="/" className="block"><img src={LANDING_LOGO_SRC} alt="Cleanr" width={906} height={209} loading="lazy" decoding="async" className={LANDING_LOGO_FOOTER_CLASS} /></Link>
          <div className="text-center sm:text-right">
            <div className="mb-2 flex flex-wrap items-center justify-center gap-4 text-sm sm:justify-end">
              <Link to={FOUNDING_CIRCLE_ENTRY_PATH} className="font-medium text-slate-700 hover:text-slate-950">Founding Circle</Link>
              <a href="#faq" className="font-medium text-slate-700 hover:text-slate-950">FAQ</a>
              <a href="/service-area.html" className="font-medium text-slate-700 hover:text-slate-950">Service area</a>
              <Link to="/trust-safety" className="font-medium text-slate-700 hover:text-slate-950">Trust & Safety</Link>
            </div>
            <p className="text-sm text-slate-600">© 2026 Cleanr. Home cleaning made simple.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
