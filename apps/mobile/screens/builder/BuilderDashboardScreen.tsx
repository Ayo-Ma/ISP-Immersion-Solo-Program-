import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, ScrollView } from 'react-native';

import { useTheme } from '../../theme';
import {
  listAssignedDisciples,
  listPendingReviewChecklists,
  type AssignedDisciple,
} from '../../lib/queries/builder';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';
import type { BuilderStackScreenProps } from '../../navigation/BuilderNavigator';

/** Phase 5: "Dashboard listing assigned disciples with at-a-glance status." */
export function BuilderDashboardScreen({
  navigation,
}: BuilderStackScreenProps<'BuilderDashboard'>) {
  const theme = useTheme();
  const [disciples, setDisciples] = useState<AssignedDisciple[] | null>(null);
  const [pendingDiscipleIds, setPendingDiscipleIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [roster, pending] = await Promise.all([
        listAssignedDisciples(),
        listPendingReviewChecklists(),
      ]);
      setDisciples(roster);
      setPendingDiscipleIds(new Set(pending.map((c) => c.disciple_id)));
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
  if (!disciples) return <LoadingState />;

  if (disciples.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
        <EmptyState
          title="No disciples assigned yet"
          description="Once leadership assigns a disciple to you, they'll show up here."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.md }}>
        {disciples.map((disciple) => {
          const pending = pendingDiscipleIds.has(disciple.id);
          return (
            <Card
              key={disciple.id}
              title={disciple.name}
              meta={disciple.email}
              onPress={() =>
                navigation.navigate('DiscipleDetail', {
                  discipleId: disciple.id,
                  discipleName: disciple.name,
                })
              }
            >
              <Badge tone={pending ? 'attention' : 'neutral'}>
                {pending ? 'Checklist awaiting review' : 'Nothing pending'}
              </Badge>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
