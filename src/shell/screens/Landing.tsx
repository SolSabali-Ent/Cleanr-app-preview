import { useEffect, type ReactNode } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  ChevronDown,
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
import { Link } from "react-router-dom";
import { captureReferralCodeFromUrl } from "../../lib/referralRef";
import {
  CUSTOMER_ENTRY_PATH,
  CSP_ENTRY_PATH,
  LOGIN_PATH,
} from "../../lib/entryRoutes";
import {
  cleanrBrand,
  LANDING_LOGO_FOOTER_CLASS,
  LANDING_LOGO_HERO_CLASS,
  LANDING_LOGO_HERO_SRC,
  LANDING_LOGO_SRC,
} from "../../lib/brand";

const c = cleanrBrand.color;

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type FaqGroup = {
  title: string;
  description: string;
  items: FaqItem[];
};

const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "For customers",
    description: "Booking, continuity, payments, safety, and what happens around a visit.",
    items: [
      {
        question: "What is Cleanr?",
        answer:
          "Cleanr is a residential cleaning platform built around reliable service and lasting relationships. We handle booking, scheduling, payments, communication, and support so households and service providers can focus more on the actual service experience.",
      },
      {
        question: "How does booking work?",
        answer:
          "Enter your service address, choose the cleaning service you need, select an available time, and complete payment securely online. Cleanr verifies the service location and confirms an eligible provider for the visit.",
      },
      {
        question: "Can I book recurring cleaning?",
        answer:
          "Yes. Cleanr supports recurring residential cleaning, where familiarity with your home and preferences can make future visits smoother over time.",
      },
      {
        question: "Will I get the same service provider each time?",
        answer:
          "Whenever possible, Cleanr prioritizes continuity. If you and a provider work well together, we want that relationship to continue instead of unnecessarily rematching every visit.",
      },
      {
        question: "Can I reschedule my cleaning?",
        answer:
          "Yes. Customers and service providers can request schedule changes. Cleanr is designed to help both sides find a workable solution while preserving a good relationship whenever possible.",
      },
      {
        question: "What if there is a problem with my cleaning?",
        answer:
          "You can report a booking-specific issue through Cleanr. The visit can be placed under review while the situation is evaluated, and an open issue prevents the booking from automatically moving forward to payout.",
      },
      {
        question: "How long do I have to review a completed service?",
        answer:
          "After the provider finishes the service and Cleanr verifies that they have safely departed, you have a 24-hour review window to confirm the visit or report an issue. If no issue is open and no action is taken, the visit can automatically confirm after that window.",
      },
      {
        question: "Does Cleanr show me my provider’s exact location?",
        answer:
          "No. Cleanr can use provider location for specific operational milestones such as on-the-way, arrival, start, and safe-departure verification. Customers receive useful visit updates, not a live map of the provider’s exact location.",
      },
      {
        question: "Are photos taken inside my home?",
        answer:
          "Providers may optionally document relevant before- or after-service conditions when it helps protect the household or provider. Visit evidence is private by default and is not automatically treated as household memory or shown to the customer.",
      },
    ],
  },
  {
    title: "For service providers",
    description: "Independent work, earnings, scheduling, safety, and long-term opportunity.",
    items: [
      {
        question: "Who can become a Cleanr service provider?",
        answer:
          "Cleanr works with independent residential cleaning professionals who meet current provider requirements and want access to customers, scheduling tools, payments, support, and a trusted local network.",
      },
      {
        question: "Are Cleanr service providers employees?",
        answer:
          "Cleanr service providers participate as independent contractors under the applicable provider agreement. They manage their own availability and independent business activity within the platform’s operating requirements.",
      },
      {
        question: "Do I have to give up my existing customers to join Cleanr?",
        answer:
          "No. Cleanr is designed to support relationships, not take ownership of them. Providers can bring existing relationships into Cleanr where appropriate and use the platform for infrastructure such as scheduling, payments, support, and business tools.",
      },
      {
        question: "Can providers reschedule their own appointments?",
        answer:
          "Providers can request schedule changes through Cleanr. The goal is to resolve timing issues collaboratively while protecting customer continuity whenever possible.",
      },
      {
        question: "When do providers get paid?",
        answer:
          "Provider earnings move through service completion, customer review, payout approval, and Stripe transfer. Cleanr’s longer-term direction is to support faster eligible-provider payouts after safely completed jobs while preserving appropriate customer and platform protections.",
      },
      {
        question: "Why does Cleanr verify that I have left the property after a job?",
        answer:
          "Provider safety matters. Cleanr separates finishing the cleaning work from closing the visit. A provider marks the service finished while still at the property, then Cleanr verifies that they have moved away from the service address before the visit fully closes.",
      },
      {
        question: "Is Cleanr only for people who want to clean forever?",
        answer:
          "No. A strong, profitable cleaning practice can absolutely be the goal. For others, cleaning may become a starting point toward mentorship, business ownership, education, another profession, investing, or other long-term goals. Cleanr is meant to expand choice, not define one version of success.",
      },
    ],
  },
  {
    title: "About Cleanr",
    description: "What we are building and why the experience is different.",
    items: [
      {
        question: "How is Cleanr different from a typical cleaning marketplace?",
        answer:
          "Most marketplaces optimize around individual transactions. Cleanr is building around continuity: repeated service, stronger customer-provider relationships, trusted local networks, and technology that removes administrative friction instead of replacing human connection.",
      },
      {
        question: "Does Cleanr own the customer-provider relationship?",
        answer:
          "No. Cleanr supports the relationship through scheduling, payments, protection, communication, reputation, coverage, and other infrastructure. The goal is to keep creating enough value that people choose to remain connected—not to manufacture dependency.",
      },
      {
        question: "Where is Cleanr available?",
        answer:
          "Cleanr is currently focused on building residential service density in the Atlanta area. Availability can vary by address and provider coverage.",
      },
      {
        question: "Is Cleanr only a cleaning company?",
        answer:
          "Residential cleaning is the foundation of Cleanr today. Over time, the network can create additional opportunities for people inside the ecosystem when those opportunities emerge from real relationships, capabilities, and demonstrated demand.",
      },
      {
        question: "What does ‘Cleaning is the transaction; connection is the experience’ mean?",
        answer:
          "A clean home is the service being purchased. Recurring service can also create familiarity, trust, accountability, and human connection. Cleanr is designed to automate the administrative work around the visit so those relationships have room to develop naturally.",
      },
    ],
  },
];

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div
      className="rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
      style={{ borderColor: c.border }}
    >
      <div
        className="flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ backgroundColor: c.iconBg, color: c.icon }}
      >
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold" style={{ color: c.ink }}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: c.inkMuted }}>
        {description}
      </p>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: c.primary }}>
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: c.ink }}>
        {title}
      </h2>
      <p className="mt-4 text-lg leading-relaxed" style={{ color: c.inkMuted }}>
        {description}
      </p>
    </div>
  );
}

function FaqItemRow({ item }: { item: FaqItem }) {
  return (
    <details className="group border-b last:border-b-0" style={{ borderColor: c.border }}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-left [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold leading-6" style={{ color: c.ink }}>
          {item.question}
        </span>
        <ChevronDown
          className="mt-1 h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
          style={{ color: c.inkMuted }}
          aria-hidden
        />
      </summary>
      <p className="pb-5 pr-7 text-sm leading-6" style={{ color: c.inkMuted }}>
        {item.answer}
      </p>
    </details>
  );
}

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
      className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-lg px-8 py-4 text-center font-medium text-white shadow-md transition-colors"
      style={{ backgroundColor: c.primary, boxShadow: `0 4px 14px ${c.primary}4D` }}
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
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/media/hero-cleaning-poster.jpg"
          aria-hidden="true"
          tabIndex={-1}
          className="absolute inset-0 h-full w-full object-cover object-top"
        >
          <source src="/media/cleanr-hero.mp4" type="video/mp4" />
        </video>

        <div className="pointer-events-none absolute inset-0 bg-[#071A2F]/45" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-[#071A2F]/20 to-[#071A2F]/65" />

        <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-7xl flex-col px-6 pb-10 pt-8 sm:pb-12 lg:pt-10">
          <div className="flex min-w-0 items-start justify-between gap-3 md:items-center md:gap-4">
            <Link to="/" className="block min-w-0 shrink sm:max-w-none" aria-label="Cleanr home">
              <img
                src={LANDING_LOGO_HERO_SRC}
                alt="Cleanr"
                width={906}
                height={209}
                loading="eager"
                decoding="async"
                className={LANDING_LOGO_HERO_CLASS}
              />
            </Link>

            <nav className="mt-0.5 flex shrink-0 items-center justify-end gap-2" aria-label="Public navigation">
              <a
                href="#faq"
                className="inline-flex min-h-11 min-w-[44px] items-center justify-center rounded-lg px-3 py-2 text-xs font-medium text-white/90 transition-colors hover:text-white sm:px-3.5 sm:text-sm"
              >
                FAQ
              </a>
              <Link
                to={LOGIN_PATH}
                className="inline-flex min-h-11 min-w-[44px] items-center justify-center rounded-lg border border-white/45 bg-black/10 px-3 py-2 text-xs font-medium text-white shadow-sm backdrop-blur-md transition-colors hover:border-white/65 hover:bg-black/20 sm:px-3.5 sm:text-sm"
              >
                Log in
              </Link>
            </nav>
          </div>

          <div className="flex flex-1 items-center py-10 sm:py-14 lg:py-16">
            <div className="max-w-3xl">
              <h1 className="max-w-[12ch] text-[44px] font-bold leading-[0.98] text-white drop-shadow-lg sm:text-5xl sm:leading-[0.95] lg:text-7xl lg:leading-[0.93]">
                A cleaner home,
                <br />
                without the back-and-forth.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-[1.55] text-white/95 drop-shadow-md sm:text-xl md:mt-8 md:text-2xl">
                Book trusted residential cleaning support with a clear, simple service experience.
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row">
                <HeroPrimaryLink to={CUSTOMER_ENTRY_PATH}>
                  Book a clean
                  <ArrowRight className="h-5 w-5 shrink-0" />
                </HeroPrimaryLink>
                <HeroSecondaryLink to={CSP_ENTRY_PATH}>Earn with Cleanr</HeroSecondaryLink>
              </div>

              <p className="mt-6 text-sm font-medium text-white/80 drop-shadow-sm sm:mt-8">
                Residential cleaning. Clear booking. Reliable support.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="For customers"
            title="Book residential cleaning in a few clear steps"
            description="Choose what you need, share home details, and follow a straightforward booking flow—built for homes, not facilities."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <FeatureCard icon={<Sparkles className="h-6 w-6" />} title="Choose your clean" description="Pick a residential service type that fits your home and schedule." />
            <FeatureCard icon={<CalendarDays className="h-6 w-6" />} title="Pick a time" description="Select a visit window that works for your household." />
            <FeatureCard icon={<Home className="h-6 w-6" />} title="Add home details" description="Share access notes and preferences so your provider knows what to expect." />
            <FeatureCard icon={<FileCheck className="h-6 w-6" />} title="Get confirmation" description="See booking details in one place after you submit your request." />
            <FeatureCard icon={<Star className="h-6 w-6" />} title="Review after service" description="Share feedback when the visit is complete to help future bookings." />
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-20" style={{ backgroundColor: c.sectionAlt }}>
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="For Cleanr service providers"
            title="Grow your residential cleaning work on your terms"
            description="Independent providers use Cleanr to manage availability, complete home cleans, and build trust with customers."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <FeatureCard icon={<UserCircle className="h-6 w-6" />} title="Create your profile" description="Introduce your experience and service area so customers know who you are." />
            <FeatureCard icon={<Clock className="h-6 w-6" />} title="Set your availability" description="Choose when you are open for residential jobs that fit your calendar." />
            <FeatureCard icon={<MapPin className="h-6 w-6" />} title="Get matched" description="Receive residential opportunities aligned with your service area and preferences." />
            <FeatureCard icon={<ClipboardList className="h-6 w-6" />} title="Complete cleans" description="Follow job details, check in, and finish visits with clear status updates." />
            <FeatureCard icon={<BadgeCheck className="h-6 w-6" />} title="Build your reputation" description="Earn reviews and repeat interest from customers who value reliable home care." />
          </div>
          <div className="mt-10 flex justify-center">
            <BluePrimaryLink to={CSP_ENTRY_PATH}>
              Earn with Cleanr
              <ArrowRight className="h-5 w-5 shrink-0" />
            </BluePrimaryLink>
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Why Cleanr"
            title="Residential-first, with room to grow"
            description="Cleanr keeps the experience focused on home cleaning—clear flows for customers and providers, without turning into a catch-all marketplace."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard icon={<ArrowRight className="h-6 w-6" />} title="Clear booking flow" description="Customers move through booking steps with predictable status and confirmation." />
            <FeatureCard icon={<Home className="h-6 w-6" />} title="Residential-first focus" description="Service types and copy stay oriented to home cleaning—not offices or facilities." />
            <FeatureCard icon={<Users className="h-6 w-6" />} title="Provider profiles" description="See who is completing work in your home with profile and application context." />
            <FeatureCard icon={<Bell className="h-6 w-6" />} title="Service reminders" description="Stay informed before and around your visit with in-app booking updates." />
            <FeatureCard icon={<Star className="h-6 w-6" />} title="Reviews and feedback" description="Capture post-visit ratings to inform future residential bookings." />
            <FeatureCard icon={<Repeat className="h-6 w-6" />} title="Repeat booking support" description="Return customers can book again with saved context where the product supports it." />
            <FeatureCard icon={<RefreshCw className="h-6 w-6" />} title="Referral-ready experience" description="Share Cleanr with others when referral flows are enabled in your market." />
            <FeatureCard icon={<Shield className="h-6 w-6" />} title="Behind-the-scenes coordination" description="Cleanr keeps booking, reminders, service updates, and support connected behind the scenes so households and providers can focus on the relationship." />
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-20" style={{ backgroundColor: c.sectionAlt }}>
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Residential services"
            title="Home cleaning options"
            description="Service availability may vary by market. Choose the clean type that matches your home."
          />
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {["Standard clean", "Deep clean", "Move-out clean", "Recurring upkeep", "Home reset"].map((label) => (
              <span key={label} className="inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-sm" style={{ borderColor: c.border, color: c.ink }}>
                <Sparkles className="h-4 w-4" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-6 bg-white px-6 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Frequently asked questions"
            title="A few things worth knowing before you book or join"
            description="Clear answers about residential visits, provider work, safety, payments, continuity, and what Cleanr is building."
          />
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {FAQ_GROUPS.map((group) => (
              <section key={group.title} className="self-start rounded-2xl border bg-white p-5 shadow-sm sm:p-6" style={{ borderColor: c.border }}>
                <h3 className="text-lg font-semibold" style={{ color: c.ink }}>{group.title}</h3>
                <p className="mt-2 text-sm leading-6" style={{ color: c.inkMuted }}>{group.description}</p>
                <div className="mt-4 border-t" style={{ borderColor: c.border }}>
                  {group.items.map((item) => <FaqItemRow key={item.question} item={item} />)}
                </div>
              </section>
            ))}
          </div>
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-6" style={{ color: c.inkMuted }}>
            Have a visit-specific safety or service concern? Use the support tools inside your booking so Cleanr can preserve the right context and respond appropriately.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 sm:py-24" style={{ backgroundColor: c.heroBg }}>
        <div className="mx-auto max-w-3xl text-center text-white">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready for a cleaner home?</h2>
          <p className="mt-4 text-lg leading-relaxed text-white/90">Start with a simple booking flow built for residential cleaning.</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <HeroPrimaryLink to={CUSTOMER_ENTRY_PATH}>
              Book a clean
              <ArrowRight className="h-5 w-5 shrink-0" />
            </HeroPrimaryLink>
            <HeroSecondaryLink to={CSP_ENTRY_PATH}>Earn with Cleanr</HeroSecondaryLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <Link to="/" className="block">
            <img src={LANDING_LOGO_SRC} alt="Cleanr" width={906} height={209} loading="lazy" decoding="async" className={LANDING_LOGO_FOOTER_CLASS} />
          </Link>
          <div className="text-center sm:text-right">
            <div className="mb-2 flex items-center justify-center gap-4 text-sm sm:justify-end">
              <a href="#faq" className="font-medium text-slate-700 hover:text-slate-950">FAQ</a>
              <Link to="/trust-safety" className="font-medium text-slate-700 hover:text-slate-950">Trust & Safety</Link>
            </div>
            <p className="text-sm text-slate-600">© 2026 Cleanr. Residential cleaning made simple.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
