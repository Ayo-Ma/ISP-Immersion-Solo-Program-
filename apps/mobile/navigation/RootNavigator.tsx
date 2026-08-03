import { NavigationContainer } from '@react-navigation/native';

import { useTheme } from '../theme';
import { useAuth } from '../lib/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RoleTabs } from './RoleTabs';
import { LoadingState } from '../components/LoadingState';

/**
 * The whole of Phase 3's routing decision: no session -> LoginScreen
 * (identity mode); session but no resolved role yet -> loading; resolved
 * role -> that role's shell. Nothing else branches here — which role sees
 * which FEATURES is Phase 4-6, not this phase.
 */
export function RootNavigator() {
  const theme = useTheme();
  const { session, profile, loading } = useAuth();

  const navTheme = {
    dark: theme.mode === 'dark',
    colors: {
      primary: theme.colors.signalActive,
      background: theme.colors.surfaceCanvas,
      card: theme.base.canvas,
      text: theme.colors.textHeading,
      border: theme.colors.borderHairline,
      notification: theme.colors.textAttention,
    },
    fonts: {
      regular: { fontFamily: theme.font.text, fontWeight: '400' as const },
      medium: { fontFamily: theme.font.textMedium, fontWeight: '500' as const },
      bold: { fontFamily: theme.font.display, fontWeight: '600' as const },
      heavy: { fontFamily: theme.font.display, fontWeight: '600' as const },
    },
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      {!session || !profile ? <LoginScreen /> : <RoleTabs role={profile.role} />}
    </NavigationContainer>
  );
}
