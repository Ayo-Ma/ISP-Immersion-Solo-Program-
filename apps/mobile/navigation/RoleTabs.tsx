import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { UserRole } from '@isp-app/shared-types';

import { useTheme } from '../theme';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { DiscipleNavigator } from './DiscipleNavigator';
import { BuilderNavigator } from './BuilderNavigator';
import { LeadershipNavigator } from './LeadershipNavigator';

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
 * Home + Profile at the tab level; each role's actual information
 * architecture lives inside that role's own stack navigator, swapped in
 * under the Home tab. Supervising Minister and Lead Pastor share
 * LeadershipNavigator (Phase 6) — same two approval queues, different
 * stage each role owns; see that navigator's own comment.
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
        {() => {
          if (role === 'disciple') return <DiscipleNavigator />;
          if (role === 'builder') return <BuilderNavigator />;
          if (role === 'supervising_minister' || role === 'lead_pastor') {
            return <LeadershipNavigator />;
          }
          return <HomeScreen role={role} />;
        }}
      </Tab.Screen>
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
