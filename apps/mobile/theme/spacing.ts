/**
 * ISP spacing — tokens/spacing.css. 4px base unit; only these values are
 * ever used for layout. RN points map 1:1 to the source px values on a
 * standard density baseline.
 */

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 96,
} as const;

export const padding = {
  card: 24,
  cardRich: 32,
  banner: 48,
  panel: 24,
  button: { vertical: 8, horizontal: 14 },
  input: { vertical: 8, horizontal: 12 },
  badge: { vertical: 2, horizontal: 8 },
} as const;

export const touch = {
  min: 44,
  cta: 48,
} as const;
