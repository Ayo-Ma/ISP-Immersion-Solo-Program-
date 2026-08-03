import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

export type AvatarStatus = 'online' | 'away' | 'offline';

export interface AvatarProps {
  src?: string;
  name?: string;
  initials?: string;
  size?: number;
  status?: AvatarStatus;
}

/** ISP round identity avatar — ported from components/status/Avatar.jsx. */
export function Avatar({ src, name = '', initials, size = 36, status }: AvatarProps) {
  const theme = useTheme();
  const mono =
    initials ||
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const statusColor: Record<AvatarStatus, string> | Record<string, never> = status
    ? {
        online: theme.colors.textSuccess,
        away: theme.colors.signalActive,
        offline: theme.colors.textTertiary,
      }
    : {};

  return (
    <View style={{ width: size, height: size }}>
      {src ? (
        <Image
          source={{ uri: src }}
          accessibilityLabel={name}
          style={{
            width: size,
            height: size,
            borderRadius: theme.radius.pill,
            borderWidth: theme.borderWidth.hairline,
            borderColor: theme.colors.borderHairline,
          }}
        />
      ) : (
        <View
          accessibilityLabel={name || undefined}
          style={[
            styles.monogram,
            {
              width: size,
              height: size,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceNested,
              borderColor: theme.colors.borderHairline,
            },
          ]}
        >
          <Text
            style={{
              color: theme.colors.textBody,
              fontFamily: theme.font.textMedium,
              fontSize: Math.max(10, Math.round(size * 0.36)),
            }}
          >
            {mono}
          </Text>
        </View>
      )}
      {status ? (
        <View
          style={[
            styles.statusDot,
            {
              width: Math.max(8, Math.round(size * 0.26)),
              height: Math.max(8, Math.round(size * 0.26)),
              borderRadius: theme.radius.pill,
              backgroundColor: statusColor[status],
              borderColor: theme.colors.surfaceCanvas,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  monogram: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    borderWidth: 2,
  },
});
