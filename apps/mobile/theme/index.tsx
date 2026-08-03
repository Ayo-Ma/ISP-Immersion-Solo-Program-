import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, baseColors, type SemanticColors } from './colors';
import { fontFamily, typeScale, identityTypeScale, fontWeight } from './typography';
import { space, padding, touch } from './spacing';
import { radius, borderWidth } from './radii';
import { focusRing, scrim, NO_SHADOW } from './elevation';
import { duration, easing, amplitude, reducedMotionAmplitude } from './motion';

export interface Theme {
  mode: 'dark' | 'light';
  colors: SemanticColors;
  base: typeof baseColors;
  font: typeof fontFamily;
  type: typeof typeScale;
  identityType: typeof identityTypeScale;
  weight: typeof fontWeight;
  space: typeof space;
  padding: typeof padding;
  touch: typeof touch;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  focusRing: typeof focusRing;
  scrim: typeof scrim;
  shadow: typeof NO_SHADOW;
  duration: typeof duration;
  easing: typeof easing;
  amplitude: typeof amplitude;
  reducedMotionAmplitude: typeof reducedMotionAmplitude;
}

function buildTheme(mode: 'dark' | 'light'): Theme {
  return {
    mode,
    colors: mode === 'dark' ? darkColors : lightColors,
    base: baseColors,
    font: fontFamily,
    type: typeScale,
    identityType: identityTypeScale,
    weight: fontWeight,
    space,
    padding,
    touch,
    radius,
    borderWidth,
    focusRing,
    scrim,
    shadow: NO_SHADOW,
    duration,
    easing,
    amplitude,
    reducedMotionAmplitude,
  };
}

export const darkTheme = buildTheme('dark');
export const lightTheme = buildTheme('light');

/**
 * Dark-first (design system readme: "every design decision should be made
 * dark-first, then verified in light mode"). Falls back to dark whenever
 * the OS reports no preference, rather than defaulting to light.
 */
const ThemeContext = createContext<Theme>(darkTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const theme = useMemo(() => (scheme === 'light' ? lightTheme : darkTheme), [scheme]);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
