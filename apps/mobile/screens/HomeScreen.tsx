import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import type { UserRole } from '@isp-app/shared-types';

import { useTheme } from '../theme';
import { useAuth } from '../lib/AuthContext';
import { Card } from '../components/Card';

/**
 * Phase 3 shell only — role-correct landing with no feature logic, per the
 * Gate. Copy uses this project's real domain terms (Builder, Disciple,
 * Pathway), not the source design system's generic "coach/participant/
 * cohort" placeholder language (see Phase 3 planning: visual tokens are
 * authoritative, screen content is not).
 */
const ROLE_COPY: Record<UserRole, { eyebrow: string; nextUp: string }> = {
  disciple: {
    eyebrow: 'Your pathway',
    nextUp: "Today's lesson, your daily checklist, and your growth stage will live here (Phase 4).",
  },
  builder: {
    eyebrow: 'Your disciples',
    nextUp:
      'Your roster, checklist reviews, and weekly check-in scheduling will live here (Phase 5).',
  },
  supervising_minister: {
    eyebrow: 'Discipleship unit',
    nextUp:
      'Pathway and graduation approval queues, plus org-wide reporting, will live here (Phase 6).',
  },
  lead_pastor: {
    eyebrow: 'Full visibility',
    nextUp:
      'Pathway and graduation approval queues, plus org-wide reporting, will live here (Phase 6).',
  },
};

export function HomeScreen({ role }: { role: UserRole }) {
  const theme = useTheme();
  const { profile } = useAuth();
  const copy = ROLE_COPY[role];

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
            {copy.eyebrow}
          </Text>
          <Text
            style={{
              fontFamily: theme.font.display,
              fontSize: theme.type.displayMd.fontSize,
              lineHeight: theme.type.displayMd.lineHeight,
              letterSpacing: theme.type.displayMd.letterSpacing,
              color: theme.colors.textHeading,
            }}
          >
            {profile ? `Welcome, ${profile.name.split(' ')[0]}` : 'Welcome'}
          </Text>
        </View>

        <Card eyebrow="Coming next" title="This is a shell">
          {copy.nextUp}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
