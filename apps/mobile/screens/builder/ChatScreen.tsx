import { SafeAreaView } from 'react-native';

import { useTheme } from '../../theme';
import { useAuth } from '../../lib/AuthContext';
import { ChatThread } from '../../components/ChatThread';
import type { BuilderStackScreenProps } from '../../navigation/BuilderNavigator';

/** Phase 7: 1:1 chat with one assigned disciple. No prayer controls — only the disciple clocks themselves in/out. */
export function ChatScreen({ route }: BuilderStackScreenProps<'Chat'>) {
  const theme = useTheme();
  const { profile } = useAuth();
  const { discipleId, discipleName } = route.params;

  if (!profile) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ChatThread
        builderId={profile.id}
        discipleId={discipleId}
        partnerName={discipleName}
        showPrayerControls={false}
      />
    </SafeAreaView>
  );
}
