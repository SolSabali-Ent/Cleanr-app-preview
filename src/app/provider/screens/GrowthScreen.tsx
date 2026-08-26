import { ArrowRight, Compass, Lightbulb, Network, Sparkles } from "lucide-react";
import {
  CSP_CARD_PADDING,
  CSP_PRIMARY_BUTTON,
  CSP_SURFACE,
  CSP_SECTION_GAP,
  CSP_TEXT_PRIMARY,
  CSP_TEXT_SECONDARY,
} from "@/theme/cspTheme";

/**
 * Growth is the CSP transformation surface.
 *
 * This screen is intentionally persistence-light until the North Star/opportunity
 * tables are live. It establishes the product boundary and language without
 * inventing stored state while Supabase is unavailable.
 */
export default function GrowthScreen() {
  return (
    <div className="pb-24" style={{ color: CSP_TEXT_PRIMARY }}>
      <header style={{ marginBottom: CSP_SECTION_GAP }}>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
          <Sparkles size={14} style={{ color: CSP_PRIMARY_BUTTON }} />
          <span style={{ color: CSP_TEXT_SECONDARY }}>Your growth inside Cleanr</span>
        </div>
        <h1 className="text-2xl font-semibold">Your North Star</h1>
        <p className="mt-2 text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
          Cleaning can be a strong practice, a source of stability, or the beginning of something else.
          You decide what you&apos;re building toward.
        </p>
      </header>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <div
          className="rounded-2xl border"
          style={{
            backgroundColor: CSP_SURFACE,
            borderColor: "rgba(248, 250, 252, 0.08)",
            padding: CSP_CARD_PADDING,
          }}
        >
          <div className="mb-3 flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${CSP_PRIMARY_BUTTON}20` }}
            >
              <Compass size={20} style={{ color: CSP_PRIMARY_BUTTON }} />
            </div>
            <div>
              <p className="text-sm font-medium">What are you building toward?</p>
              <p className="text-xs" style={{ color: CSP_TEXT_SECONDARY }}>
                Your answer belongs to you.
              </p>
            </div>
          </div>

          <p className="text-sm leading-6" style={{ color: CSP_TEXT_SECONDARY }}>
            This will become your persistent North Star when the growth data layer is connected. It may be a
            thriving cleaning practice, homeownership, education, a business, another career, investing, more
            family time, or something Cleanr never predicted.
          </p>

          <button
            type="button"
            disabled
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold opacity-70"
            title="North Star persistence will activate when the backend is available"
          >
            Define my North Star
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      <section style={{ marginBottom: CSP_SECTION_GAP }}>
        <h2 className="mb-3 text-sm font-medium" style={{ color: CSP_TEXT_SECONDARY }}>
          What Cleanr can grow with you
        </h2>
        <div className="space-y-3">
          <div
            className="rounded-2xl border"
            style={{
              backgroundColor: CSP_SURFACE,
              borderColor: "rgba(248, 250, 252, 0.08)",
              padding: CSP_CARD_PADDING,
            }}
          >
            <div className="flex items-start gap-3">
              <Lightbulb size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
              <div>
                <p className="text-sm font-medium">Capabilities</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  Cleaning skills are one part of what you can do. Over time, Cleanr can recognize service,
                  mentoring, leadership, business, and other capabilities without changing your current role.
                </p>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl border"
            style={{
              backgroundColor: CSP_SURFACE,
              borderColor: "rgba(248, 250, 252, 0.08)",
              padding: CSP_CARD_PADDING,
            }}
          >
            <div className="flex items-start gap-3">
              <Compass size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
              <div>
                <p className="text-sm font-medium">Opportunities</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  Jobs stay in Jobs. Growth opportunities will be broader: mentorship, training, referrals,
                  leadership, business, vendor, education, external, and other North-Star-aligned paths.
                </p>
              </div>
            </div>
          </div>

          <div
            className="rounded-2xl border"
            style={{
              backgroundColor: CSP_SURFACE,
              borderColor: "rgba(248, 250, 252, 0.08)",
              padding: CSP_CARD_PADDING,
            }}
          >
            <div className="flex items-start gap-3">
              <Network size={19} style={{ color: CSP_PRIMARY_BUTTON, marginTop: 2 }} />
              <div>
                <p className="text-sm font-medium">Contribution</p>
                <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
                  As you grow, you may mentor, refer, create opportunities, build a business, employ others, or
                  strengthen the network in ways that have nothing to do with cleaning more houses.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div
          className="rounded-2xl border"
          style={{
            backgroundColor: "rgba(141, 204, 100, 0.08)",
            borderColor: "rgba(141, 204, 100, 0.22)",
            padding: CSP_CARD_PADDING,
          }}
        >
          <p className="text-sm font-medium">Cleanr grows when you gain more choices.</p>
          <p className="mt-1 text-xs leading-5" style={{ color: CSP_TEXT_SECONDARY }}>
            A profitable cleaning practice may be your destination. It may also be the economic engine that helps
            you reach something else. Cleanr is designed to support either path.
          </p>
        </div>
      </section>
    </div>
  );
}
