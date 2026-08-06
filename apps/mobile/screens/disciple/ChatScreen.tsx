import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native';

import { useTheme } from '../../theme';
import { useAuth } from '../../lib/AuthContext';
import { getMyActiveBuilder } from '../../lib/queries/disciple';
import { ChatThread } from '../../components/ChatThread';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';

/** Phase 7: 1:1 chat with the disciple's assigned Builder, prayer clock-in/out embedded. */
export function ChatScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const [builder, setBuilder] = useState<{ id: string; name: string } | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setBuilder(undefined);
    getMyActiveBuilder()
      .then(setBuilder)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  if (error) return <ErrorState onRetry={load} />;
  if (builder === undefined || !profile) return <LoadingState />;

  if (!builder) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
        <EmptyState
          title="No Builder assigned yet"
          description="Chat opens up once a Builder is assigned to you."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ChatThread
        builderId={builder.id}
        discipleId={profile.id}
        partnerName={builder.name}
        showPrayerControls
      />
    </SafeAreaView>
  );
}
