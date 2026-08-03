import { SafeAreaView, Text, View } from 'react-native';

import { useTheme } from '../theme';
import { useAuth } from '../lib/AuthContext';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';

const ROLE_LABEL: Record<string, string> = {
  lead_pastor: 'Lead Pastor',
  supervising_minister: 'Supervising Minister',
  builder: 'Builder',
  disciple: 'Disciple',
};

export function ProfileScreen() {
  const theme = useTheme();
  const { profile, signOut } = useAuth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <View style={{ flex: 1, padding: theme.space.xl, gap: theme.space.lg }}>
        <View style={{ gap: theme.space.xs }}>
          <Text
            style={{
              fontFamily: theme.font.display,
              fontSize: theme.type.headline.fontSize,
              color: theme.colors.textHeading,
            }}
          >
            {profile?.name ?? '—'}
          </Text>
          <Text
            style={{
              fontFamily: theme.font.text,
              fontSize: theme.type.body.fontSize,
              color: theme.colors.textSubtle,
            }}
          >
            {profile?.email ?? '—'}
          </Text>
          {profile ? <Badge tone="signal">{ROLE_LABEL[profile.role]}</Badge> : null}
        </View>

        <View style={{ marginTop: 'auto' }}>
          <Button variant="tertiary" fullWidth onPress={signOut}>
            Sign out
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
