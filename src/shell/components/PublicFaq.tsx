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
    description: "Booking, continuity, payments, safety, and what happens around a visit.",
    items: [
      { question: "What is Cleanr?", answer: "Cleanr is a residential cleaning platform built around reliable service and lasting relationships. We handle booking, scheduling, payments, communication, and support so households and service providers can focus more on the actual service experience." },
      { question: "How does booking work?", answer: "Enter your service address, choose the cleaning service you need, select an available time, and complete payment securely online. Cleanr verifies the service location and confirms an eligible provider for the visit." },
      { question: "Can I book recurring cleaning?", answer: "Yes. Cleanr supports recurring residential cleaning, where familiarity with your home and preferences can make future visits smoother over time." },
      { question: "Will I get the same service provider each time?", answer: "Whenever possible, Cleanr prioritizes continuity. If you and a provider work well together, we want that relationship to continue instead of unnecessarily rematching every visit." },
      { question: "Can I reschedule my cleaning?", answer: "Yes. Customers and service providers can request schedule changes. Cleanr is designed to help both sides find a workable solution while preserving a good relationship whenever possible." },
      { question: "What if there is a problem with my cleaning?", answer: "You can report a booking-specific issue through Cleanr. The visit can be placed under review while the situation is evaluated, and an open issue prevents the booking from automatically moving forward to payout." },
      { question: "How long do I have to review a completed service?", answer: "After the provider finishes the service and Cleanr verifies that they have safely departed, you have a 24-hour review window to confirm the visit or report an issue. If no issue is open and no action is taken, the visit can automatically confirm after that window." },
      { question: "Does Cleanr show me my provider’s exact location?", answer: "No. Cleanr can use provider location for specific operational milestones such as on-the-way, arrival, start, and safe-departure verification. Customers receive useful visit updates, not a live map of the provider’s exact location." },
      { question: "Are photos taken inside my home?", answer: "Providers may optionally document relevant before- or after-service conditions when it helps protect the household or provider. Visit evidence is private by default and is not automatically treated as household memory or shown to the customer." },
    ],
  },
  {
    title: "For service providers",
    shortLabel: "Providers",
    description: "Independent work, earnings, scheduling, safety, and long-term opportunity.",
    items: [
      { question: "Who can become a Cleanr service provider?", answer: "Cleanr works with independent residential cleaning professionals who meet current provider requirements and want access to customers, scheduling tools, payments, support, and a trusted local network." },
      { question: "Are Cleanr service providers employees?", answer: "Cleanr service providers participate as independent contractors under the applicable provider agreement. They manage their own availability and independent business activity within the platform’s operating requirements." },
      { question: "Do I have to give up my existing customers to join Cleanr?", answer: "No. Cleanr is designed to support relationships, not take ownership of them. Providers can bring existing relationships into Cleanr where appropriate and use the platform for infrastructure such as scheduling, payments, support, and business tools." },
      { question: "Can providers reschedule their own appointments?", answer: "Providers can request schedule changes through Cleanr. The goal is to resolve timing issues collaboratively while protecting customer continuity whenever possible." },
      { question: "When do providers get paid?", answer: "Provider earnings move through service completion, customer review, payout approval, and Stripe transfer. Cleanr’s longer-term direction is to support faster eligible-provider payouts after safely completed jobs while preserving appropriate customer and platform protections." },
      { question: "Why does Cleanr verify that I have left the property after a job?", answer: "Provider safety matters. Cleanr separates finishing the cleaning work from closing the visit. A provider marks the service finished while still at the property, then Cleanr verifies that they have moved away from the service address before the visit fully closes." },
      { question: "Is Cleanr only for people who want to clean forever?", answer: "No. A strong, profitable cleaning practice can absolutely be the goal. For others, cleaning may become a starting point toward mentorship, business ownership, education, another profession, investing, or other long-term goals. Cleanr is meant to expand choice, not define one version of success." },
    ],
  },
  {
    title: "About Cleanr",
    shortLabel: "About Cleanr",
    description: "What we are building and why the experience is different.",
    items: [
      { question: "How is Cleanr different from a typical cleaning marketplace?", answer: "Most marketplaces optimize around individual transactions. Cleanr is building around continuity: repeated service, stronger customer-provider relationships, trusted local networks, and technology that removes administrative friction instead of replacing human connection." },
      { question: "Does Cleanr own the customer-provider relationship?", answer: "No. Cleanr supports the relationship through scheduling, payments, protection, communication, reputation, coverage, and other infrastructure. The goal is to keep creating enough value that people choose to remain connected—not to manufacture dependency." },
      { question: "Where is Cleanr available?", answer: "Cleanr is currently focused on building residential service density in the Atlanta area. Availability can vary by address and provider coverage." },
      { question: "Is Cleanr only a cleaning company?", answer: "Residential cleaning is the foundation of Cleanr today. Over time, the network can create additional opportunities for people inside the ecosystem when those opportunities emerge from real relationships, capabilities, and demonstrated demand." },
      { question: "What does ‘Cleaning is the transaction; connection is the experience’ mean?", answer: "A clean home is the service being purchased. Recurring service can also create familiarity, trust, accountability, and human connection. Cleanr is designed to automate the administrative work around the visit so those relationships have room to develop naturally." },
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
          <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight text-[#0B1220] sm:text-4xl">Everything you need before you book.</h2>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-[#667085]">Start the booking first. Choose a CSP if you want one. We’ll only ask you to sign in when it’s time to continue securely toward payment.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-start xl:flex-row">
            <Link to={CUSTOMER_ENTRY_PATH} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#0000FE] px-7 py-3 font-medium text-white">
              Book now <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#meet-cleanr-csps" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-7 py-3 font-medium text-[#0B1220]">Meet CSPs</a>
          </div>
          <p className="mt-4 max-w-md text-xs leading-5 text-[#667085]">Need help with a visit already in progress? Use the support tools inside that booking so Cleanr keeps the right context attached.</p>
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
