import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Clock,
  FileCheck,
  Home,
  MapPin,
  RefreshCw,
  Repeat,
  Shield,
  Sparkles,
  Star,
  UserCircle,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

const c = {
  hero: "#0B0F1F",
  blue: "#0000FE",
  green: "#8DCC64",
  ink: "#0B1220",
  muted: "#667085",
  border: "#E5E7EB",
  alt: "#F8FAFC",
};

function FeatureCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: c.border }}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: "rgba(141,204,100,.14)", color: c.green }}>
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold" style={{ color: c.ink }}>{title}</h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: c.muted }}>{description}</p>
    </div>
  );
}

function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: c.blue }}>{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: c.ink }}>{title}</h2>
      <p className="mt-4 text-lg leading-relaxed" style={{ color: c.muted }}>{description}</p>
    </div>
  );
}

function PreviewLink({ children, primary = false }: { children: ReactNode; primary?: boolean }) {
  return (
    <a
      href="#preview"
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-8 py-4 text-center font-medium sm:w-auto"
      style={primary ? { background: c.blue, color: "white" } : { border: "1px solid rgba(255,255,255,.35)", background: "rgba(255,255,255,.08)", color: "white" }}
      aria-label={`${String(children)} — public preview`}
    >
      {children}
    </a>
  );
}

export default function App() {
  return (
    <main id="preview" className="min-h-screen bg-white">
      <section className="relative overflow-hidden text-white" style={{ background: c.hero }}>
        <div className="pointer-events-none absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 35px,rgba(255,255,255,.06) 35px,rgba(255,255,255,.06) 70px)" }} />
        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-8 sm:pb-24 lg:min-h-screen lg:py-10">
          <header className="flex items-center justify-between gap-4">
            <a href="#preview" className="text-4xl font-black tracking-[-0.06em] sm:text-5xl" aria-label="Cleanr home">cleanr</a>
            <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/90">Public preview</span>
          </header>

          <div className="grid items-center gap-12 pt-20 lg:grid-cols-2 lg:pt-28">
            <div>
              <p className="mb-5 text-sm font-semibold uppercase tracking-[.18em]" style={{ color: c.green }}>Residential cleaning, simplified</p>
              <h1 className="text-[44px] font-bold leading-[.98] sm:text-6xl lg:text-7xl">A cleaner home,<br />without the back-and-forth.</h1>
              <p className="mt-7 max-w-2xl text-xl leading-relaxed text-white/85">Book trusted residential cleaning support with a clear, simple service experience.</p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <PreviewLink primary>Book a clean <ArrowRight className="h-5 w-5" /></PreviewLink>
                <PreviewLink>Earn with Cleanr</PreviewLink>
              </div>
              <p className="mt-7 text-sm text-white/65">Residential cleaning. Clear booking. Reliable support.</p>
            </div>

            <div className="relative mx-auto w-full max-w-lg">
              <div className="rotate-1 rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "rgba(141,204,100,.14)", color: c.green }}><CalendarCheck className="h-6 w-6" /></div>
                  <div><div className="text-sm" style={{ color: c.muted }}>Booking status</div><div className="font-semibold" style={{ color: c.ink }}>Ready to schedule</div></div>
                </div>
                <div className="space-y-3">
                  {[['Service','Standard clean'],['Next step','Pick a time'],['Home','Details added']].map(([label,value]) => (
                    <div key={label} className="rounded-xl border p-4" style={{ borderColor: c.border, background: c.alt }}>
                      <div className="flex items-center justify-between gap-4 text-sm"><span style={{ color: c.muted }}>{label}</span><span className="font-semibold" style={{ color: c.ink }}>{value}</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-5 -left-3 -rotate-2 rounded-2xl bg-white p-4 shadow-xl sm:-left-7">
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: c.ink }}><Shield className="h-5 w-5" style={{ color: c.green }} /> Clear confirmation</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <Heading eyebrow="For customers" title="Book residential cleaning in a few clear steps" description="Choose what you need, share home details, and follow a straightforward booking flow—built for homes, not facilities." />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <FeatureCard icon={<Sparkles className="h-6 w-6" />} title="Choose your clean" description="Pick a residential service type that fits your home and schedule." />
            <FeatureCard icon={<CalendarDays className="h-6 w-6" />} title="Pick a time" description="Select a visit window that works for your household." />
            <FeatureCard icon={<Home className="h-6 w-6" />} title="Add home details" description="Share access notes and preferences so your provider knows what to expect." />
            <FeatureCard icon={<FileCheck className="h-6 w-6" />} title="Get confirmation" description="See booking details in one place after you submit your request." />
            <FeatureCard icon={<Star className="h-6 w-6" />} title="Review after service" description="Share feedback when the visit is complete to help future bookings." />
          </div>
        </div>
      </section>

      <section className="px-6 py-20" style={{ background: c.alt }}>
        <div className="mx-auto max-w-7xl">
          <Heading eyebrow="For Cleanr service providers" title="Grow your residential cleaning work on your terms" description="Independent providers use Cleanr to manage availability, complete home cleans, and build trust with customers." />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            <FeatureCard icon={<UserCircle className="h-6 w-6" />} title="Create your profile" description="Introduce your experience and service area so customers know who you are." />
            <FeatureCard icon={<Clock className="h-6 w-6" />} title="Set your availability" description="Choose when you are open for residential jobs that fit your calendar." />
            <FeatureCard icon={<MapPin className="h-6 w-6" />} title="Get matched" description="Receive residential opportunities aligned with your service area and preferences." />
            <FeatureCard icon={<ClipboardList className="h-6 w-6" />} title="Complete cleans" description="Follow job details, check in, and finish visits with clear status updates." />
            <FeatureCard icon={<BadgeCheck className="h-6 w-6" />} title="Build your reputation" description="Earn reviews and repeat interest from customers who value reliable home care." />
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <Heading eyebrow="Why Cleanr" title="Residential-first, with room to grow" description="Cleanr keeps the experience focused on home cleaning—clear flows for customers and providers, without turning into a catch-all marketplace." />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon={<ArrowRight className="h-6 w-6" />} title="Clear booking flow" description="Customers move through booking steps with predictable status and confirmation." />
            <FeatureCard icon={<Users className="h-6 w-6" />} title="Provider profiles" description="See who is completing work in your home with profile and application context." />
            <FeatureCard icon={<Bell className="h-6 w-6" />} title="Service reminders" description="Stay informed before and around your visit with in-app booking updates." />
            <FeatureCard icon={<Repeat className="h-6 w-6" />} title="Repeat booking support" description="Return customers can book again with saved context where the product supports it." />
            <FeatureCard icon={<RefreshCw className="h-6 w-6" />} title="Referral-ready" description="Share Cleanr with others when referral flows are enabled in your market." />
            <FeatureCard icon={<Shield className="h-6 w-6" />} title="Trust & safety" description="Clear service expectations and lifecycle support keep the experience understandable." />
          </div>
        </div>
      </section>

      <section className="px-6 py-20 text-white" style={{ background: c.hero }}>
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[.18em]" style={{ color: c.green }}>Cleanr public preview</p>
          <h2 className="mt-4 text-4xl font-bold sm:text-5xl">A simpler way to connect homes and independent cleaning professionals.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-white/75">This repository intentionally contains only the public preview surface. Production application logic, infrastructure, credentials, internal documentation, and backend implementation remain private.</p>
        </div>
      </section>
    </main>
  );
}
