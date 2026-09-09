import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { CUSTOMER_ENTRY_PATH } from "../../lib/entryRoutes";

type FaqItem = { question: string; answer: string };
type FaqGroup = { title: string; shortLabel: string; description: string; items: FaqItem[] };

const FAQ_GROUPS: FaqGroup[] = [
  {
    title: "For customers",
    shortLabel: "Customers",
    description: "Booking, payments, safety, and what happens before and after a visit.",
    items: [
      { question: "What is Cleanr?", answer: "Cleanr helps people book home cleaning and keep good provider relationships going. We handle booking, scheduling, payments, messages, and support." },
      { question: "How does booking work?", answer: "Enter your address, choose the cleaning you need, pick a time, and pay online. Cleanr checks the service area and connects the visit with a provider who can take the job." },
      { question: "Can I book recurring cleaning?", answer: "Yes. You can book cleaning that repeats. Over time, the same provider can get to know your home and your preferences." },
      { question: "Will I get the same service provider each time?", answer: "When possible, yes. If you and a provider work well together, Cleanr tries to keep that relationship going instead of starting over each time." },
      { question: "Can I reschedule my cleaning?", answer: "Yes. You or your provider can ask to change the time. Cleanr helps both sides find a time that works." },
      { question: "What if there is a problem with my cleaning?", answer: "You can report a problem from that booking. Cleanr can review what happened before the visit moves on to payout." },
      { question: "How long do I have to review a completed service?", answer: "After the provider finishes and leaves the service address, you have 24 hours to confirm the visit or report a problem. If nothing is reported, the visit can confirm on its own after that window." },
      { question: "Does Cleanr show me my provider’s exact location?", answer: "No. Cleanr may use location to know when a provider is on the way, arrives, starts, or leaves. You get useful updates, not a live map of the provider." },
      { question: "Are photos taken inside my home?", answer: "A provider may take before or after photos when they help explain what happened during a visit. These photos are kept private unless they are needed for support or review." },
    ],
  },
  {
    title: "For service providers",
    shortLabel: "Providers",
    description: "Independent work, pay, scheduling, safety, and what comes next.",
    items: [
      { question: "Who can become a Cleanr service provider?", answer: "Cleanr works with independent home cleaning providers who meet our current requirements and want help with customers, scheduling, payments, support, and local connections." },
      { question: "Are Cleanr service providers employees?", answer: "No. Cleanr service providers work as independent contractors under the provider agreement. They choose when they are available and run their own work within Cleanr’s rules." },
      { question: "Do I have to give up my existing customers to join Cleanr?", answer: "No. If you already serve households, you can keep those relationships. Cleanr can help with scheduling, payments, support, and tools around the work." },
      { question: "Can providers reschedule their own appointments?", answer: "Providers can ask to change a visit time through Cleanr. The goal is to find a time that works for both sides and keep a good relationship intact." },
      { question: "When do providers get paid?", answer: "A job moves from completion to customer review, payout approval, and then Stripe sends the money. Cleanr is also working toward faster payouts when a job is safely completed and ready to pay." },
      { question: "Why does Cleanr check that I have left the property after a job?", answer: "Provider safety matters. You mark the cleaning finished while you are still there. Cleanr then checks that you have left the service address before the visit fully closes." },
      { question: "Is Cleanr only for people who want to clean forever?", answer: "No. A strong cleaning business can be the goal. For others, cleaning may lead to mentoring, business ownership, school, another career, investing, or other goals. Cleanr is built to expand your choices." },
    ],
  },
  {
    title: "About Cleanr",
    shortLabel: "About Cleanr",
    description: "What we are building and why it feels different.",
    items: [
      { question: "How is Cleanr different from a typical cleaning marketplace?", answer: "Cleanr is not built only around one job at a time. We want good customer-provider relationships to grow over repeated visits, while the app handles the busywork around them." },
      { question: "Does Cleanr own the customer-provider relationship?", answer: "No. Cleanr supports the relationship with scheduling, payments, support, backup help, reviews, and business tools. The goal is to be useful enough that people choose to stay connected." },
      { question: "Where is Cleanr available?", answer: "Cleanr is focused on the Atlanta area right now. What is available can change by address and by which providers are nearby." },
      { question: "Is Cleanr only a cleaning company?", answer: "Home cleaning is where Cleanr starts. Over time, the people in the network may create more kinds of work, help, and opportunity when there is a real need for it." },
      { question: "What does ‘Cleaning is the transaction; connection is the experience’ mean?", answer: "The cleaning is the service you pay for. When people work together again and again, trust and familiarity can grow. Cleanr handles more of the busywork so there is room for that to happen naturally." },
    ],
  },
];

export function PublicFaq() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = FAQ_GROUPS[activeIndex] ?? FAQ_GROUPS[0];

  return (
    <section id="faq" className="scroll-mt-6 bg-[#F7F9FC] px-6 py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#166534]">Questions?</p>
          <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight text-[#0B1220] sm:text-4xl">What to know before you book.</h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-[#667085]">Start your booking first. Choose a CSP if you want one. We’ll ask you to sign in when it’s time to move toward payment.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-start xl:flex-row">
            <Link to={CUSTOMER_ENTRY_PATH} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#0000FE] px-7 py-3 font-medium text-white">
              Book now <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#meet-cleanr-csps" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-7 py-3 font-medium text-[#0B1220]">Meet CSPs</a>
          </div>
          <p className="mt-4 max-w-md text-xs leading-5 text-[#667085]">Need help with a visit that is already happening? Open that booking and use the support tools there.</p>
        </div>

        <div>
          <div className="flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="FAQ categories">
            {FAQ_GROUPS.map((group, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={group.title}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveIndex(index)}
                  className={`relative min-h-12 whitespace-nowrap px-4 text-sm font-semibold transition-colors ${selected ? "text-[#0B1220]" : "text-[#667085] hover:text-[#0B1220]"}`}
                >
                  {group.shortLabel}
                  {selected ? <span className="absolute inset-x-4 bottom-0 h-0.5 bg-[#0000FE]" /> : null}
                </button>
              );
            })}
          </div>

          <div key={active.title} className="mt-2" role="tabpanel">
            <div className="border-b border-slate-200 py-6">
              <p className="text-lg font-semibold text-[#0B1220]">{active.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#667085]">{active.description}</p>
            </div>
            {active.items.map((item) => (
              <details key={item.question} className="group border-b border-slate-200">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
                  <span className="text-sm font-semibold leading-6 text-[#0B1220] sm:text-base">{item.question}</span>
                  <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[#667085] transition-transform duration-200 group-open:rotate-180" aria-hidden />
                </summary>
                <p className="pb-5 pr-7 text-sm leading-6 text-[#667085]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
