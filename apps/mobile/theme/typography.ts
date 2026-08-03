/**
 * ISP typography — ported from tokens/typography.css + tokens/fonts.css
 * (Phase 3 design import). Font family names below must exactly match the
 * keys loaded via useFonts() in App.tsx.
 *
 * The source system's flagged substitutions (Instrument Sans / IBM Plex
 * Sans / IBM Plex Mono standing in for unreleased "ISP Display/Text/Mono"
 * binaries) are used as-is here — swapping to the licensed set later only
 * touches App.tsx's font loading, not any of these values.
 */

export const fontFamily = {
  display: 'InstrumentSans_600SemiBold',
  displayMedium: 'InstrumentSans_500Medium',
  text: 'IBMPlexSans_400Regular',
  textMedium: 'IBMPlexSans_500Medium',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export interface TextStyleToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

// Workflow scale
export const typeScale = {
  displayXl: { fontFamily: fontFamily.display, fontSize: 80, lineHeight: 84, letterSpacing: -3 },
  displayLg: { fontFamily: fontFamily.display, fontSize: 56, lineHeight: 62, letterSpacing: -1.8 },
  displayMd: { fontFamily: fontFamily.display, fontSize: 40, lineHeight: 46, letterSpacing: -1 },
  headline: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  cardTitle: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  subhead: { fontFamily: fontFamily.display, fontSize: 20, lineHeight: 28, letterSpacing: -0.2 },
  bodyLg: { fontFamily: fontFamily.text, fontSize: 18, lineHeight: 27, letterSpacing: -0.1 },
  body: { fontFamily: fontFamily.text, fontSize: 16, lineHeight: 24, letterSpacing: -0.05 },
  bodySm: { fontFamily: fontFamily.text, fontSize: 14, lineHeight: 21, letterSpacing: 0 },
  caption: { fontFamily: fontFamily.text, fontSize: 12, lineHeight: 17, letterSpacing: 0 },
  button: { fontFamily: fontFamily.textMedium, fontSize: 14, lineHeight: 17, letterSpacing: 0 },
  eyebrow: { fontFamily: fontFamily.textMedium, fontSize: 13, lineHeight: 17, letterSpacing: 0.4 },
  mono: { fontFamily: fontFamily.mono, fontSize: 13, lineHeight: 20, letterSpacing: 0 },
} satisfies Record<string, TextStyleToken>;

// Identity scale — all-caps, one monumental statement per screen (see
// theme/README-usage in components for the "never more than one per
// screen" rule).
export const identityTypeScale = {
  xxl: { fontFamily: fontFamily.display, fontSize: 120, lineHeight: 110, letterSpacing: -2 },
  xl: { fontFamily: fontFamily.display, fontSize: 80, lineHeight: 76, letterSpacing: -1.5 },
  lg: { fontFamily: fontFamily.displayMedium, fontSize: 54, lineHeight: 55, letterSpacing: -1 },
  md: { fontFamily: fontFamily.displayMedium, fontSize: 40, lineHeight: 48, letterSpacing: -0.6 },
  feature: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  cardTitle: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  micro: { fontFamily: fontFamily.textMedium, fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
} satisfies Record<string, TextStyleToken>;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
} as const;
