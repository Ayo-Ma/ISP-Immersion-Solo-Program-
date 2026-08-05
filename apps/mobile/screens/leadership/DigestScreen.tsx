import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, ScrollView } from 'react-native';

import { useTheme } from '../../theme';
import { listDigestNotifications, type DigestNotification } from '../../lib/queries/leadership';
import { Card } from '../../components/Card';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';

/**
 * Phase 6: "Daily digest view (see Phase 8 — this is where the digest
 * actually surfaces)." This reads real notifications.channel='digest'
 * rows honestly — there just aren't any yet, since the compilation job
 * that batches passive events (module completions, logins, etc.) into a
 * daily digest is explicit Phase 8 scope, not presumed here.
 */
export function DigestScreen() {
  const theme = useTheme();
  const [notifications, setNotifications] = useState<DigestNotification[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setNotifications(await listDigestNotifications());
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
  if (!notifications) return <LoadingState />;

  if (notifications.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
        <EmptyState
          title="No digest items yet"
          description="Passive events (module completions, logins, and similar) will appear here once the daily digest compilation job is wired up."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.md }}>
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            eyebrow={new Date(notification.created_at).toLocaleDateString()}
            title={notification.event_type}
          >
            {JSON.stringify(notification.payload)}
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
