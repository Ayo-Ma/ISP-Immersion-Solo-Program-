import { ActivityIndicator, SafeAreaView, Text, View } from 'react-native';

import { useTheme } from '../theme';

export function LoadingState({ label }: { label?: string }) {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space.md }}
      >
        <ActivityIndicator size="large" color={theme.colors.signalActive} />
        {label ? (
          <Text
            style={{
              fontFamily: theme.font.text,
              fontSize: theme.type.bodySm.fontSize,
              color: theme.colors.textSubtle,
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
