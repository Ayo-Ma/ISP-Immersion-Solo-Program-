import { useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { useTheme, type Theme } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';
export type ButtonStatus = 'idle' | 'loading' | 'success';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  status?: ButtonStatus;
  loadingLabel?: string;
  successLabel?: string;
  onPress?: (event: GestureResponderEvent) => void;
  children: ReactNode;
  testID?: string;
}

const SIZES: Record<ButtonSize, { minHeight: number; fontSize: number; gap: number }> = {
  sm: { minHeight: 32, fontSize: 13, gap: 6 },
  md: { minHeight: 44, fontSize: 14, gap: 8 },
  lg: { minHeight: 48, fontSize: 16, gap: 10 },
};

function variantColors(theme: Theme, variant: ButtonVariant, pressed: boolean, disabled: boolean) {
  const { colors } = theme;
  if (disabled) {
    return {
      background: colors.surfaceCard,
      text: colors.textDisabled,
      border: colors.borderHairline,
    };
  }
  switch (variant) {
    case 'secondary':
      return {
        background: pressed ? colors.actionSecondaryHover : colors.actionSecondary,
        text: colors.textHeading,
        border: colors.borderHairline,
      };
    case 'tertiary':
      return {
        background: pressed ? colors.surfaceCard : 'transparent',
        text: colors.textHeading,
        border: 'transparent',
      };
    case 'inverse':
      return { background: colors.surfaceInverse, text: colors.textInverse, border: 'transparent' };
    case 'ghost':
      return {
        background: pressed ? colors.actionGhostHover : 'transparent',
        text: colors.textHeading,
        border: pressed ? colors.actionGhostBorderHover : colors.actionGhostBorder,
      };
    default:
      return {
        background: pressed ? colors.actionPrimaryPress : colors.actionPrimary,
        text: colors.textOnPrimary,
        border: 'transparent',
      };
  }
}

/**
 * ISP button — ported from components/actions/Button.jsx. Primary is the
 * single amber signal on a surface; every other variant stays quiet.
 * Web-only concerns dropped: hover states (no pointer on mobile), the
 * SVG path-drawing success checkmark (swapped for a plain glyph — a
 * spring-drawn checkmark isn't worth a bespoke Reanimated path here).
 */
export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  fullWidth = false,
  iconLeft,
  iconRight,
  status = 'idle',
  loadingLabel = 'Working…',
  successLabel = 'Done',
  onPress,
  children,
  testID,
}: ButtonProps) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const dims = SIZES[size];
  const busy = status === 'loading';
  const done = status === 'success';
  const inert = disabled || busy;

  const handlePressIn = () => {
    if (inert) return;
    Animated.timing(scale, {
      toValue: theme.amplitude.pressScale,
      duration: theme.duration.instant,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: theme.duration.instant,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy }}
      disabled={inert}
      onPress={inert ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      testID={testID}
    >
      {({ pressed }) => {
        const skin = done
          ? {
              background: theme.colors.statusSuccessTint,
              text: theme.colors.textSuccess,
              border: theme.colors.textSuccess,
            }
          : variantColors(theme, variant, pressed, disabled);

        return (
          <Animated.View
            style={[
              styles.base,
              {
                minHeight: dims.minHeight,
                borderRadius: theme.radius.md,
                paddingHorizontal: theme.padding.button.horizontal,
                paddingVertical: theme.padding.button.vertical,
                backgroundColor: skin.background,
                borderColor: skin.border,
                width: fullWidth ? '100%' : undefined,
                transform: [{ scale }],
              },
            ]}
          >
            {busy || done ? (
              <View style={[styles.content, { gap: dims.gap }]}>
                {busy ? (
                  <ActivityIndicator size="small" color={skin.text} />
                ) : (
                  <Text style={{ color: skin.text, fontSize: dims.fontSize }}>✓</Text>
                )}
                <Text
                  style={[
                    styles.label,
                    {
                      color: skin.text,
                      fontSize: dims.fontSize,
                      fontFamily: theme.font.textMedium,
                    },
                  ]}
                >
                  {busy ? loadingLabel : successLabel}
                </Text>
              </View>
            ) : (
              <View style={[styles.content, { gap: dims.gap }]}>
                {iconLeft}
                {typeof children === 'string' ? (
                  <Text
                    style={[
                      styles.label,
                      {
                        color: skin.text,
                        fontSize: dims.fontSize,
                        fontFamily: theme.font.textMedium,
                      },
                    ]}
                  >
                    {children}
                  </Text>
                ) : (
                  children
                )}
                {iconRight}
              </View>
            )}
          </Animated.View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    letterSpacing: 0,
  },
});
