import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';

import {
  getMyLatestPathwayRequest,
  getMyActiveEnrollment,
  type PathwayRequestRow,
} from '../lib/queries/disciple';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { RegistrationScreen } from '../screens/disciple/RegistrationScreen';
import { PathwayStatusScreen } from '../screens/disciple/PathwayStatusScreen';
import { DashboardScreen } from '../screens/disciple/DashboardScreen';
import { LessonScreen } from '../screens/disciple/LessonScreen';
import { TestScreen } from '../screens/disciple/TestScreen';
import { ChecklistScreen } from '../screens/disciple/ChecklistScreen';
import { GrowthScreen } from '../screens/disciple/GrowthScreen';

export type DiscipleStackParamList = {
  Dashboard: undefined;
  Lesson: { moduleProgressId: string };
  Test: { moduleProgressId: string };
  Checklist: undefined;
  Growth: undefined;
};

export type DiscipleStackScreenProps<T extends keyof DiscipleStackParamList> =
  NativeStackScreenProps<DiscipleStackParamList, T>;

const Stack = createNativeStackNavigator<DiscipleStackParamList>();

/**
 * Phase 4 Gate: registration -> approval -> module -> retake -> checklist,
 * end to end. This component IS that routing decision: no pathway request
 * yet -> Registration; one pending/rejected -> PathwayStatus; approved
 * (which the Phase 4 trigger now turns into a real enrollment) -> the
 * actual app.
 */
export function DiscipleNavigator() {
  const [request, setRequest] = useState<PathwayRequestRow | null | undefined>(undefined);
  const [hasEnrollment, setHasEnrollment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [req, enrollment] = await Promise.all([
        getMyLatestPathwayRequest(),
        getMyActiveEnrollment(),
      ]);
      setRequest(req);
      setHasEnrollment(!!enrollment);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error) return <ErrorState onRetry={load} />;
  if (request === undefined) return <LoadingState />;

  if (!request) {
    return <RegistrationScreen onSubmitted={load} />;
  }

  if (request.status !== 'approved' || !hasEnrollment) {
    return <PathwayStatusScreen request={request} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: true }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Home' }} />
      <Stack.Screen name="Lesson" component={LessonScreen} options={{ title: 'Lesson' }} />
      <Stack.Screen name="Test" component={TestScreen} options={{ title: 'Test' }} />
      <Stack.Screen name="Checklist" component={ChecklistScreen} options={{ title: 'Checklist' }} />
      <Stack.Screen name="Growth" component={GrowthScreen} options={{ title: 'Growth' }} />
    </Stack.Navigator>
  );
}
