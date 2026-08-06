import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';

import { BuilderDashboardScreen } from '../screens/builder/BuilderDashboardScreen';
import { DiscipleDetailScreen } from '../screens/builder/DiscipleDetailScreen';
import { ChatScreen } from '../screens/builder/ChatScreen';

export type BuilderStackParamList = {
  BuilderDashboard: undefined;
  DiscipleDetail: { discipleId: string; discipleName: string };
  Chat: { discipleId: string; discipleName: string };
};

export type BuilderStackScreenProps<T extends keyof BuilderStackParamList> = NativeStackScreenProps<
  BuilderStackParamList,
  T
>;

const Stack = createNativeStackNavigator<BuilderStackParamList>();

/**
 * Phase 5 Gate: a Builder reviews and approves/rejects a real submitted
 * checklist, with the correct downstream state change and notification.
 * Roster -> disciple detail (checklist review, graduation recommendation,
 * weekly check-in) is the full Builder Experience roadmap for this phase.
 */
export function BuilderNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="BuilderDashboard"
        component={BuilderDashboardScreen}
        options={{ title: 'My Disciples' }}
      />
      <Stack.Screen
        name="DiscipleDetail"
        component={DiscipleDetailScreen}
        options={({ route }) => ({ title: route.params.discipleName })}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({ title: route.params.discipleName })}
      />
    </Stack.Navigator>
  );
}
