import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import {
  getMyGrowthProgress,
  listGrowthStages,
  type GrowthProgressRow,
} from '../../lib/queries/disciple';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';

/**
 * PRD Section C.14 fix: show explicit, visible per-stage criteria, not
 * leave advancement implicit. PRD Section E lists the actual criteria as
 * a still-open item awaiting leadership answers — this screen shows
 * whatever growth_stages rows exist (with their real criteria text) and
 * the disciple's current position, but doesn't invent stage content or
 * auto-assign an initial stage, since nothing in Phase 1/2 does that and
 * this isn't the phase to decide it quietly.
 */
export function GrowthScreen() {
  const theme = useTheme();
  const [progress, setProgress] = useState<GrowthProgressRow | null | undefined>(undefined);
  const [stages, setStages] = useState<GrowthProgressRow['growth_stages'][]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setProgress(undefined);
    Promise.all([getMyGrowthProgress(), listGrowthStages()])
      .then(([p, s]) => {
        setProgress(p);
        setStages(s);
      })
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  if (error) return <ErrorState onRetry={load} />;
  if (progress === undefined) return <LoadingState />;

  if (stages.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
        <EmptyState
          title="Growth stages aren't set up yet"
          description="Church leadership hasn't defined the growth stages or their criteria yet."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.lg }}>
        <Text
          style={{
            fontFamily: theme.font.display,
            fontSize: theme.type.displayMd.fontSize,
            lineHeight: theme.type.displayMd.lineHeight,
            color: theme.colors.textHeading,
          }}
        >
          Your growth
        </Text>

        <View style={{ gap: theme.space.md }}>
          {stages.map((stage) => {
            const isCurrent = progress?.current_stage_id === stage.id;
            const isPast = progress
              ? stage.order_index < (progress.growth_stages?.order_index ?? -1)
              : false;
            return (
              <Card
                key={stage.id}
                variant={isCurrent ? 'featured' : 'default'}
                eyebrow={isCurrent ? 'You are here' : undefined}
                title={stage.name}
              >
                {stage.criteria}
                {isCurrent ? (
                  <View style={{ marginTop: theme.space.xs }}>
                    <Badge tone="signal">Current stage</Badge>
                  </View>
                ) : isPast ? (
                  <View style={{ marginTop: theme.space.xs }}>
                    <Badge tone="success">Completed</Badge>
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>

        {!progress ? (
          <Text
            style={{
              fontFamily: theme.font.text,
              fontSize: theme.type.bodySm.fontSize,
              color: theme.colors.textSubtle,
            }}
          >
            You have not been placed on a growth stage yet — talk with your Builder.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
