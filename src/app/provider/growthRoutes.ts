export const CSP_GROWTH_ROUTES = {
  home: "/csp/growth",
  milestones: "/csp/growth/milestones",
  capabilities: "/csp/growth/capabilities",
  opportunities: "/csp/growth/opportunities",
  network: "/csp/growth/network",
  contributions: "/csp/growth/contributions",
} as const;

/**
 * Growth is a first-class CSP product area, not a deep dashboard implementation detail.
 * Keep canonical URLs short and stable; legacy fit/dashboard URLs redirect in the router
 * to the single Opportunities surface rather than remaining first-class route concepts.
 */
export type CspGrowthRoute = (typeof CSP_GROWTH_ROUTES)[keyof typeof CSP_GROWTH_ROUTES];
