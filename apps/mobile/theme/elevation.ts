/**
 * ISP depth — tokens/elevation.css. There is no shadow system: depth comes
 * from the surface ladder (see theme/colors.ts surfaceCard/-Featured/-Menu)
 * and hairlines, never from RN's `shadow*`/`elevation` props. Components
 * should not set shadow styles at all — this file exists so that
 * intentional omission has a name, matching the source token
 * `--shadow-none: none`.
 */

export const focusRing = {
  widthPx: 2,
  offsetPx: 2,
  // color-mix(in srgb, gold-600 50%, transparent) — see theme/colors.ts alpha()
  color: 'rgba(168, 122, 42, 0.5)',
} as const;

export const scrim = {
  // overlay (#000000) at 68% — dialog backdrop
  dialog: 'rgba(0, 0, 0, 0.68)',
} as const;

export const NO_SHADOW = 'none' as const;
