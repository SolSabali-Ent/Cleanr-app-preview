/**
 * Cleanr marketing / landing brand tokens.
 * Source of truth for color: `src/design/tokens.ts` (+ CSP shell dark from providerTheme).
 */
import { CLEANR_BLUE, CLEANR_GREEN, COLORS } from "../design/tokens";
import { providerTheme } from "../theme/providerTheme";

export const CLEANR_LOGO_SRC = "/cleanr-app@2x.png";

export const cleanrBrand = {
  color: {
    /** CSP app shell background — used for marketing hero / final CTA band */
    heroBg: providerTheme.background,
    heroText: "#FFFFFF",
    /** Primary actions (matches `Button` primary / `CLEANR_BLUE`) */
    primary: CLEANR_BLUE,
    primaryHover: "#0000D6",
    primaryOnDark: "#FFFFFF",
    /** Secondary accent (matches `CLEANR_GREEN`) */
    green: CLEANR_GREEN,
    greenMutedBg: "rgba(141, 204, 100, 0.14)",
    /** Body / card ink */
    ink: COLORS.text,
    inkMuted: COLORS.muted,
    surface: COLORS.surface,
    surfaceMuted: COLORS.surface2,
    border: COLORS.border,
    sectionAlt: COLORS.surface2,
    iconBg: "rgba(141, 204, 100, 0.14)",
    icon: CLEANR_GREEN,
  },
} as const;

export const LANDING_LOGO_SRC = CLEANR_LOGO_SRC;

/** White wordmark on dark hero (transparent PNG, no background). */
export const LANDING_LOGO_HERO_SRC = "/cleanr-header-white.png";

/** Header logo on dark hero — large wordmark, scales on small screens. */
export const LANDING_LOGO_HERO_CLASS =
  "h-[4.2rem] w-auto max-w-[min(100%,min(588px,88vw))] object-contain object-left sm:h-[5.6rem] md:h-[6.3rem] lg:h-28";

export const LANDING_LOGO_FOOTER_CLASS = "h-8 w-auto object-contain";
