import { View, Text } from 'react-native';

import { useTheme } from '../theme';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/**
 * ISP error state — same "respectful and specific, never alarmist" rule
 * the design system applies to rejections/overdue states. Muted attention
 * color, not a red banner.
 */
export function ErrorState({
  title = 'Something went wrong',
  description = "That didn't load. Try again in a moment.",
  onRetry,
}: ErrorStateProps) {
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
      <Text
        style={{
          fontFamily: theme.font.text,
          fontSize: theme.type.bodySm.fontSize,
          color: theme.colors.textAttention,
          textAlign: 'center',
        }}
      >
        {description}
      </Text>
      {onRetry ? (
        <View style={{ marginTop: theme.space.sm }}>
          <Button variant="secondary" onPress={onRetry}>
            Try again
          </Button>
        </View>
      ) : null}
    </View>
  );
}
