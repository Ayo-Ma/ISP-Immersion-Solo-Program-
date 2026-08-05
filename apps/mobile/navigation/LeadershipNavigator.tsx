import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';

import { LeadershipDashboardScreen } from '../screens/leadership/LeadershipDashboardScreen';
import { PathwayApprovalQueueScreen } from '../screens/leadership/PathwayApprovalQueueScreen';
import { GraduationApprovalQueueScreen } from '../screens/leadership/GraduationApprovalQueueScreen';
import { DigestScreen } from '../screens/leadership/DigestScreen';
import { BuilderCapacityScreen } from '../screens/leadership/BuilderCapacityScreen';
import { ReassignBuilderScreen } from '../screens/leadership/ReassignBuilderScreen';

export type LeadershipStackParamList = {
  LeadershipDashboard: undefined;
  PathwayQueue: undefined;
  GraduationQueue: undefined;
  Digest: undefined;
  BuilderCapacity: undefined;
  ReassignBuilder: undefined;
};

export type LeadershipStackScreenProps<T extends keyof LeadershipStackParamList> =
  NativeStackScreenProps<LeadershipStackParamList, T>;

const Stack = createNativeStackNavigator<LeadershipStackParamList>();

/**
 * Shared between Supervising Minister and Lead Pastor — both roles act on
 * the same two approval queues, just at different stages of each state
 * machine (Section C.1: parallel on pathway_requests; Section C.3:
 * sequential on graduation_requests). Every screen reads
 * useAuth().profile.role to know which stage it owns, rather than two
 * near-duplicate navigators.
 */
export function LeadershipNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen
        name="LeadershipDashboard"
        component={LeadershipDashboardScreen}
        options={{ title: 'Overview' }}
      />
      <Stack.Screen
        name="PathwayQueue"
        component={PathwayApprovalQueueScreen}
        options={{ title: 'Pathway Approvals' }}
      />
      <Stack.Screen
        name="GraduationQueue"
        component={GraduationApprovalQueueScreen}
        options={{ title: 'Graduation Approvals' }}
      />
      <Stack.Screen name="Digest" component={DigestScreen} options={{ title: 'Daily Digest' }} />
      <Stack.Screen
        name="BuilderCapacity"
        component={BuilderCapacityScreen}
        options={{ title: 'Builder Capacity' }}
      />
      <Stack.Screen
        name="ReassignBuilder"
        component={ReassignBuilderScreen}
        options={{ title: 'Reassign Builder' }}
      />
    </Stack.Navigator>
  );
}
