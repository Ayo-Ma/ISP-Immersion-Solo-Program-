import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, ScrollView } from 'react-native';

import { useTheme } from '../../theme';
import { listBuilderCapacity, type BuilderCapacityRow } from '../../lib/queries/leadership';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';

/** Phase 6: "Builder capacity monitoring view." Warns at >12 (PRD Section C.4b soft cap), never blocks. */
export function BuilderCapacityScreen() {
  const theme = useTheme();
  const [builders, setBuilders] = useState<BuilderCapacityRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBuilders(await listBuilderCapacity());
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
  if (!builders) return <LoadingState />;

  if (builders.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
        <EmptyState title="No active Builders" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.md }}>
        {builders.map((builder) => (
          <Card key={builder.id} eyebrow="Builder" title={builder.name}>
            <Badge tone={builder.overSoftCap ? 'attention' : 'neutral'}>
              {builder.activeDiscipleCount} active disciple
              {builder.activeDiscipleCount === 1 ? '' : 's'}
              {builder.overSoftCap ? ' — over the 8-12 soft cap' : ''}
            </Badge>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
