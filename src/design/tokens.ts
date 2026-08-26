export const CLEANR_GREEN = "#8DCC64";
export const CLEANR_BLUE = "#0000FE";

export const COLORS = {
  green: CLEANR_GREEN,
  blue: CLEANR_BLUE,
  text: "#0B1220",
  muted: "#667085",
  border: "#E5E7EB",
  borderStrong: "#CBD5E1",
  surface: "#FFFFFF",
  surface2: "#F8FAFC",
  neutral100: "#F1F5F9",
  neutral200: "#E2E8F0",
  neutral500: "#64748B",
  danger: "#DC2626",
} as const;

export const RADIUS = {
  md: 12,
  lg: 14,
  xl: 16,
  card: 20,
} as const;

export const SPACE = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const SHADOW = {
  sm: "0 1px 2px rgba(15, 23, 42, 0.05)",
  md: "0 8px 24px rgba(15, 23, 42, 0.08)",
} as const;

export const BUTTON = {
  height: { sm: 40, md: 48, lg: 52 },
  padX: { sm: 16, md: 20, lg: 24 },
  radius: { sm: 12, md: 14, lg: 14 },
  font: { weight: 600 },
} as const;
