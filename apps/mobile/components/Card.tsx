import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

import { useTheme } from '../theme';

export type CardVariant = 'default' | 'featured';
export type CardPadding = 'compact' | 'card' | 'rich';

export interface CardProps {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  icon?: ReactNode;
  eyebrow?: string;
  title?: string;
  meta?: string;
  footer?: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  children?: ReactNode;
  testID?: string;
}

/**
 * ISP card — ported from components/surfaces/Card.jsx. Flat Surface-1 with
 * a hairline border; no shadow (design system has none — see
 * theme/elevation.ts). "Hover -> featured" from the source becomes
 * "press -> featured" here, since touch has no hover equivalent.
 */
export function Card({
  variant = 'default',
  padding = 'card',
  interactive = false,
  icon,
  eyebrow,
  title,
  meta,
  footer,
  onPress,
  children,
  testID,
}: CardProps) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  const featured = variant === 'featured' || (interactive && pressed);

  const paddingValue =
    padding === 'compact'
      ? theme.space.md
      : padding === 'rich'
        ? theme.padding.cardRich
        : theme.padding.card;

  const content = (
    <View
      style={[
        styles.base,
        {
          gap: theme.space.sm,
          padding: paddingValue,
          backgroundColor: featured ? theme.colors.surfaceCardFeatured : theme.colors.surfaceCard,
          borderColor: featured ? theme.colors.borderStrong : theme.colors.borderHairline,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      {icon ? <View style={{ marginBottom: theme.space.xxs }}>{icon}</View> : null}
      {eyebrow ? (
        <Text
          style={{
            fontFamily: theme.font.textMedium,
            fontSize: theme.type.eyebrow.fontSize,
            letterSpacing: theme.type.eyebrow.letterSpacing,
            textTransform: 'uppercase',
            color: theme.colors.textSubtle,
          }}
        >
          {eyebrow}
        </Text>
      ) : null}
      {title ? (
        <View style={styles.titleRow}>
          <Text
            style={{
              fontFamily: theme.font.displayMedium,
              fontSize: theme.type.cardTitle.fontSize,
              letterSpacing: theme.type.cardTitle.letterSpacing,
              color: theme.colors.textHeading,
              flexShrink: 1,
            }}
          >
            {title}
          </Text>
          {meta ? (
            <Text
              style={{
                fontFamily: theme.font.text,
                fontSize: theme.type.caption.fontSize,
                color: theme.colors.textSubtle,
              }}
            >
              {meta}
            </Text>
          ) : null}
        </View>
      ) : null}
      {typeof children === 'string' ? (
        <Text
          style={{
            fontFamily: theme.font.text,
            fontSize: theme.type.bodySm.fontSize,
            color: theme.colors.textBody,
          }}
        >
          {children}
        </Text>
      ) : (
        children
      )}
      {footer ? (
        <View style={[styles.footer, { gap: theme.space.sm, marginTop: theme.space.xxs }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );

  if (onPress || interactive) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        testID={testID}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
