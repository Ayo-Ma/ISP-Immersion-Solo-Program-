import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useAuth } from '../../lib/AuthContext';
import {
  getMyActiveEnrollment,
  getModuleProgressForEnrollment,
  getChecklistStreak,
  type EnrollmentRow,
  type ModuleProgressRow,
} from '../../lib/queries/disciple';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import type { DiscipleStackScreenProps } from '../../navigation/DiscipleNavigator';

/** PRD Phase 4: "Home dashboard (today's lesson, current streak/status)." */
export function DashboardScreen({ navigation }: DiscipleStackScreenProps<'Dashboard'>) {
  const theme = useTheme();
  const { profile } = useAuth();
  const [enrollment, setEnrollment] = useState<EnrollmentRow | null>(null);
  const [progress, setProgress] = useState<ModuleProgressRow[] | null>(null);
  const [streak, setStreak] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const enr = await getMyActiveEnrollment();
      setEnrollment(enr);
      if (enr) {
        const [prog, streakCount] = await Promise.all([
          getModuleProgressForEnrollment(enr.id),
          getChecklistStreak(),
        ]);
        setProgress(prog);
        setStreak(streakCount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Re-check on every focus — coming back from a Lesson/Test screen should
  // reflect whatever just changed, not a stale snapshot from mount.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error) return <ErrorState onRetry={load} />;
  if (loading) return <LoadingState />;
  if (!enrollment) {
    return (
      <ErrorState
        title="No active pathway"
        description="This screen shouldn't be reachable without one."
      />
    );
  }

  const nextModule = (progress ?? []).find(
    (p) => p.status === 'not_started' || p.status === 'in_progress',
  );
  const completedCount = (progress ?? []).filter((p) => p.status === 'passed').length;
  const totalCount = (progress ?? []).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.lg }}>
        <View style={{ gap: theme.space.xs }}>
          <Text
            style={{
              fontFamily: theme.font.textMedium,
              fontSize: theme.type.eyebrow.fontSize,
              letterSpacing: theme.type.eyebrow.letterSpacing,
              textTransform: 'uppercase',
              color: theme.colors.textSubtle,
            }}
          >
            {enrollment.pathways.name}
          </Text>
          <Text
            style={{
              fontFamily: theme.font.display,
              fontSize: theme.type.displayMd.fontSize,
              lineHeight: theme.type.displayMd.lineHeight,
              color: theme.colors.textHeading,
            }}
          >
            {profile ? `Welcome back, ${profile.name.split(' ')[0]}` : 'Welcome back'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: theme.space.md }}>
          <View style={{ flex: 1 }}>
            <Card eyebrow="Progress" title={`${completedCount} / ${totalCount}`}>
              Modules complete
            </Card>
          </View>
          <View style={{ flex: 1 }}>
            <Card eyebrow="Streak" title={String(streak)}>
              {streak === 1 ? 'day approved in a row' : 'days approved in a row'}
            </Card>
          </View>
        </View>

        {nextModule ? (
          <Card eyebrow="Today's lesson" title={nextModule.modules.title}>
            <Badge tone={nextModule.status === 'in_progress' ? 'signal' : 'neutral'}>
              {nextModule.status === 'in_progress' ? 'In progress' : 'Not started'}
            </Badge>
            <View style={{ marginTop: theme.space.sm }}>
              <Button
                variant="primary"
                onPress={() => navigation.navigate('Lesson', { moduleProgressId: nextModule.id })}
              >
                {nextModule.status === 'in_progress' ? 'Continue lesson' : 'Start lesson'}
              </Button>
            </View>
          </Card>
        ) : (
          <Card eyebrow="Today's lesson" title="All caught up">
            No modules waiting on you right now.
          </Card>
        )}

        <View style={{ flexDirection: 'row', gap: theme.space.md }}>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" fullWidth onPress={() => navigation.navigate('Checklist')}>
              Daily checklist
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" fullWidth onPress={() => navigation.navigate('Growth')}>
              Growth stage
            </Button>
          </View>
        </View>
        <Button variant="tertiary" fullWidth onPress={() => navigation.navigate('Checkin')}>
          Weekly check-in
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
