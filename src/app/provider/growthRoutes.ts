export const CSP_GROWTH_ROUTES = {
  home: "/csp/growth",
  milestones: "/csp/growth/milestones",
  capabilities: "/csp/growth/capabilities",
  opportunities: "/csp/growth/opportunities",
  fit: "/csp/growth/fit",
  contributions: "/csp/growth/contributions",
} as const;

export type CspGrowthRoute = (typeof CSP_GROWTH_ROUTES)[keyof typeof CSP_GROWTH_ROUTES];
