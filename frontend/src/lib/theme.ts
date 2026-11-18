/** Design tokens for JS consumers (Recharts), mirroring the CSS variables in globals.css. */
export const colors = {
  white: "#FFFFFF",
  softPink: "#FCEEF2",
  elegantPink: "#E8A0B4",
  burgundy: "#800F35",
  lightGray: "#F7F7F8",
  charcoal: "#29252A",
  ink2: "#5F5961",
  ink3: "#6E6870",
  line: "#EBE8EC",
  grid: "#EFEDF0",
} as const;

/**
 * Sequential ramp (light -> dark, one hue) for magnitude encodings such as the heatmap.
 * Validated with the dataviz ordinal checks: monotone lightness, adjacent dL >= 0.06,
 * light end >= 2:1 on the surface, single hue.
 */
export const sequentialRamp = ["#E8A0B4", "#C9708E", "#A8355E", "#800F35", "#4F0820"] as const;

/** Shared Recharts chrome: hairline solid grid, recessive axes, muted tick text. */
export const chartChrome = {
  grid: { stroke: colors.grid, strokeDasharray: "", vertical: false },
  tick: { fill: colors.ink3, fontSize: 12 },
  axisLine: false,
  tickLine: false,
} as const;
