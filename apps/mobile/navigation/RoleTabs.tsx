import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { UserRole } from '@isp-app/shared-types';

import { useTheme } from '../theme';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

export type RoleTabParamList = {
  Home: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RoleTabParamList>();

const ROLE_LABEL: Record<UserRole, string> = {
  lead_pastor: 'Lead Pastor',
  supervising_minister: 'Supervising Minister',
  builder: 'Builder',
  disciple: 'Disciple',
};

/**
 * Deliberately minimal (Home + Profile) rather than a full per-role tab
 * tree — Phase 3's Gate is "a role-correct home screen with no feature
 * logic yet, just the shell." The real information architecture (Builder's
 * roster, Leadership's approval queues, etc.) is what Phases 4-6 are
 * explicitly tasked with designing, not something to presume here.
 *
 * Navigation chrome stays dark regardless of light/dark mode (design
 * system rule: TopNav/nav chrome is the one persistent brand anchor) —
 * bottom tabs inherit that via theme.base.canvas rather than
 * theme.colors.surfaceCanvas, which would flip in light mode.
 */
export function RoleTabs({ role }: { role: UserRole }) {
  const theme = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.base.canvas,
          borderTopColor: theme.base.hairline,
        },
        tabBarActiveTintColor: theme.colors.signalActive,
        tabBarInactiveTintColor: theme.base.inkTertiary,
        tabBarLabelStyle: { fontFamily: theme.font.textMedium, fontSize: 11 },
      }}
    >
      <Tab.Screen name="Home" options={{ title: ROLE_LABEL[role] }}>
        {() => <HomeScreen role={role} />}
      </Tab.Screen>
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
