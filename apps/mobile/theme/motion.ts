/**
 * ISP motion — tokens/motion.css. Two tiers mirroring the two modes:
 * Workflow (color/opacity-first, no overshoot, no hover-equivalent lift —
 * mobile has no hover anyway) and Identity (spring, mild overshoot,
 * transform allowed only on arrival/achievement screens).
 *
 * Durations are in ms for direct use with RN's Animated/Reanimated timing
 * functions. Easing curves are cubic-bezier control points (same 4-number
 * form Reanimated's Easing.bezier() takes).
 */

export const duration = {
  instant: 80,
  fast: 120,
  base: 180,
  slow: 280,
  deliberate: 400,
  identity: 640,
} as const;

export const easing = {
  standard: [0.4, 0, 0.2, 1] as const,
  out: [0.16, 1, 0.3, 1] as const,
  in: [0.4, 0, 1, 1] as const,
  entrance: [0.05, 0.7, 0.1, 1] as const,
  exit: [0.3, 0, 0.8, 0.15] as const,
};

// Amplitudes: every animated distance/scale in the system resolves to one
// of these, so motion can be retuned globally. Zero under reduced-motion
// (wire to AccessibilityInfo.isReduceMotionEnabled at the call site).
export const amplitude = {
  pressScale: 0.985,
  shakeX: 3,
  enterY: 4,
  enterScale: 0.96,
} as const;

export const reducedMotionAmplitude = {
  pressScale: 1,
  shakeX: 0,
  enterY: 0,
  enterScale: 1,
} as const;
