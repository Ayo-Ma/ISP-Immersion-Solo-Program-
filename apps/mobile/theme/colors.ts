/**
 * ISP design system colors — ported from the live Claude Design import
 * (project 29a524d1, tokens/colors.css / DESIGN.md), Phase 3.
 *
 * Dark-first: dark is the base palette, light is the counterpart. React
 * Native has no CSS custom properties or `color-mix()`, so mixed values
 * (ghost borders, status tints) are pre-computed to flat hex/rgba here.
 *
 * Terminology note (flagged in Phase 3 planning, confirmed by the user):
 * the source design system's own screen content uses generic placeholder
 * language ("coach", "participant", "cohort") that does not match this
 * app's actual domain (Builder, Disciple, Pathway). Only the visual
 * tokens below are treated as authoritative — content is translated when
 * building real screens.
 */

const base = {
  gold400: '#D7AD62',
  gold500: '#C9953C',
  gold600: '#A87A2A',
  gold700: '#896521',
  onGold: '#10151C',

  ink: '#F1F3F5',
  inkMuted: '#CBD2DA',
  inkSubtle: '#8C96A3',
  inkTertiary: '#66717D',

  canvas: '#10151C',
  surface1: '#171D25',
  surface2: '#1D2530',
  surface3: '#252F3B',
  surface4: '#2D3947',

  hairline: '#2B3542',
  hairlineStrong: '#425061',
  hairlineTertiary: '#536274',

  inverseCanvas: '#F7F7F3',
  inverseSurface1: '#EEEFEA',
  inverseSurface2: '#E5E7E2',
  inverseInk: '#151A21',

  success: '#76A88A',
  attention: '#CC785D',
  info: '#6D9AC9',
  overlay: '#000000',
} as const;

export interface SemanticColors {
  textHeading: string;
  textBody: string;
  textSubtle: string;
  textTertiary: string;
  textDisabled: string;
  textOnPrimary: string;
  textInverse: string;
  textLink: string;
  textLinkHover: string;
  textSuccess: string;
  textAttention: string;
  textInfo: string;

  surfaceCanvas: string;
  surfaceCard: string;
  surfaceCardFeatured: string;
  surfaceHover: string;
  surfaceMenu: string;
  surfaceNested: string;
  surfaceInverse: string;

  borderHairline: string;
  borderStrong: string;
  borderTertiary: string;
  borderFocus: string;

  actionPrimary: string;
  actionPrimaryHover: string;
  actionPrimaryPress: string;
  actionSecondary: string;
  actionSecondaryHover: string;
  actionGhostBorder: string;
  actionGhostBorderHover: string;
  actionGhostHover: string;

  signalActive: string;
  signalMuted: string;

  statusSuccessTint: string;
  statusAttentionTint: string;
  statusInfoTint: string;
  statusGoldTint: string;
}

// color-mix(in srgb, X 28%, transparent) over an unknown background is best
// approximated in RN as the color itself at reduced alpha (rgba), since RN
// has no true mix-with-background compositing primitive.
function alpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export const darkColors: SemanticColors = {
  textHeading: base.ink,
  textBody: base.inkMuted,
  textSubtle: base.inkSubtle,
  textTertiary: base.inkTertiary,
  textDisabled: base.inkTertiary,
  textOnPrimary: base.onGold,
  textInverse: base.inverseInk,
  textLink: base.ink,
  textLinkHover: base.gold400,
  textSuccess: base.success,
  textAttention: base.attention,
  textInfo: base.info,

  surfaceCanvas: base.canvas,
  surfaceCard: base.surface1,
  surfaceCardFeatured: base.surface2,
  surfaceHover: base.surface2,
  surfaceMenu: base.surface3,
  surfaceNested: base.surface4,
  surfaceInverse: base.inverseCanvas,

  borderHairline: base.hairline,
  borderStrong: base.hairlineStrong,
  borderTertiary: base.hairlineTertiary,
  borderFocus: base.gold600,

  actionPrimary: base.gold500,
  actionPrimaryHover: base.gold400,
  actionPrimaryPress: base.gold600,
  actionSecondary: base.surface1,
  actionSecondaryHover: base.surface2,
  actionGhostBorder: alpha(base.ink, 0.28),
  actionGhostBorderHover: alpha(base.ink, 0.44),
  actionGhostHover: alpha(base.ink, 0.08),

  signalActive: base.gold500,
  signalMuted: base.gold700,

  statusSuccessTint: alpha(base.success, 0.16),
  statusAttentionTint: alpha(base.attention, 0.16),
  statusInfoTint: alpha(base.info, 0.16),
  statusGoldTint: alpha(base.gold500, 0.14),
};

export const lightColors: SemanticColors = {
  textHeading: base.inverseInk,
  textBody: '#3C444E',
  textSubtle: '#5C6570',
  textTertiary: '#7C858F',
  textDisabled: '#9AA2AB',
  textOnPrimary: base.onGold,
  textInverse: base.ink,
  textLink: base.inverseInk,
  textLinkHover: base.gold600,
  textSuccess: '#457053',
  textAttention: '#9E4D36',
  textInfo: '#3A6591',

  surfaceCanvas: base.inverseCanvas,
  surfaceCard: base.inverseSurface1,
  surfaceCardFeatured: base.inverseSurface2,
  surfaceHover: base.inverseSurface2,
  surfaceMenu: '#FFFFFF',
  surfaceNested: '#DCDED7',
  surfaceInverse: base.canvas,

  borderHairline: '#D8DAD3',
  borderStrong: '#B9BCB4',
  borderTertiary: '#A3A79E',
  borderFocus: base.gold600,

  actionPrimary: base.gold500,
  actionPrimaryHover: base.gold400,
  actionPrimaryPress: base.gold600,
  actionSecondary: base.inverseSurface1,
  actionSecondaryHover: base.inverseSurface2,
  actionGhostBorder: alpha(base.inverseInk, 0.26),
  actionGhostBorderHover: alpha(base.inverseInk, 0.44),
  actionGhostHover: alpha(base.inverseInk, 0.06),

  // Gold-500 only reaches ~3.0:1 on cream (fails AA even for large text) —
  // light mode steps to gold-600 for anything that carries meaning
  // (active nav glyph, identity eyebrow, divider). Non-text uses only.
  signalActive: base.gold600,
  signalMuted: base.gold700,

  statusSuccessTint: alpha(base.success, 0.16),
  statusAttentionTint: alpha(base.attention, 0.16),
  statusInfoTint: alpha(base.info, 0.16),
  statusGoldTint: alpha(base.gold500, 0.14),
};

export const baseColors = base;
