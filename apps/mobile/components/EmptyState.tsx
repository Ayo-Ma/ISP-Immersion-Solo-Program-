import type { ReactNode } from 'react';
import { View, Text } from 'react-native';

import { useTheme } from '../theme';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * ISP empty state — design system readme: "calm and finished, not cute"
 * ("Queue clear — nothing is waiting on you. Cohort 14 is on track.").
 * No illustration/mascot per the source rulebook; text-led and precise.
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.space.sm,
        padding: theme.space.xxl,
      }}
    >
      <Text
        style={{
          fontFamily: theme.font.displayMedium,
          fontSize: theme.type.cardTitle.fontSize,
          color: theme.colors.textHeading,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          style={{
            fontFamily: theme.font.text,
            fontSize: theme.type.bodySm.fontSize,
            color: theme.colors.textSubtle,
            textAlign: 'center',
          }}
        >
          {description}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: theme.space.sm }}>{action}</View> : null}
    </View>
  );
}
