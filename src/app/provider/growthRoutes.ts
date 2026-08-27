export const CSP_GROWTH_ROUTES = {
  home: "/csp/growth",
  milestones: "/csp/growth/milestones",
  capabilities: "/csp/growth/capabilities",
  opportunities: "/csp/growth/opportunities",
  // Fit preferences now live inside Opportunities. Keep this alias so older navigation
  // and compatibility redirects land on the single canonical opportunity surface.
  fit: "/csp/growth/opportunities",
  network: "/csp/growth/network",
  contributions: "/csp/growth/contributions",
} as const;

/**
 * Growth is a first-class CSP product area, not a deep dashboard implementation detail.
 * Keep canonical URLs short and stable; legacy dashboard URLs redirect in the router.
 */
export type CspGrowthRoute = (typeof CSP_GROWTH_ROUTES)[keyof typeof CSP_GROWTH_ROUTES];
