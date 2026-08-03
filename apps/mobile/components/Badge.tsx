import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

export type BadgeTone = 'neutral' | 'success' | 'attention' | 'info' | 'signal' | 'secure';
export type BadgeShape = 'pill' | 'square';

export interface BadgeProps {
  tone?: BadgeTone;
  shape?: BadgeShape;
  dot?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * ISP status badge — ported from components/status/Badge.jsx. Field is
 * always Surface-2 + hairline (per the source's own audit note: a filled
 * tone-colored pill reads as an alarm surface, which the rulebook
 * forbids) — the semantic color lives only in the label/dot.
 */
export function Badge({
  tone = 'neutral',
  shape = 'pill',
  dot = false,
  icon,
  children,
}: BadgeProps) {
  const theme = useTheme();
  const toneColor: Record<BadgeTone, string> = {
    neutral: theme.colors.textBody,
    success: theme.colors.textSuccess,
    attention: theme.colors.textAttention,
    info: theme.colors.textInfo,
    signal: theme.base.gold400,
    secure: theme.base.inkSubtle,
  };
  const ink = toneColor[tone];

  return (
    <View
      style={[
        styles.base,
        {
          gap: 6,
          paddingVertical: theme.padding.badge.vertical,
          paddingHorizontal: theme.padding.badge.horizontal,
          borderRadius: shape === 'pill' ? theme.radius.pill : theme.radius.xs,
          backgroundColor: theme.colors.surfaceCardFeatured,
          borderColor: theme.colors.borderHairline,
        },
      ]}
    >
      {dot ? (
        <View style={[styles.dot, { backgroundColor: ink, borderRadius: theme.radius.pill }]} />
      ) : null}
      {icon}
      <Text
        style={{ fontFamily: theme.font.text, fontSize: theme.type.caption.fontSize, color: ink }}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
  },
});
