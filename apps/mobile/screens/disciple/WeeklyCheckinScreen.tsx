import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { getMyActiveWeeklyCheckin, type WeeklyCheckinRow } from '../../lib/queries/disciple';
import { selectCheckinTime, EdgeFunctionError } from '../../lib/edgeFunctions';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';

/**
 * PRD Section C.8: "propose 3 times, disciple picks one." The other half
 * of DiscipleDetailScreen's Builder-side propose flow (Phase 5) — this is
 * where the disciple actually picks.
 */
export function WeeklyCheckinScreen() {
  const theme = useTheme();
  const [checkin, setCheckin] = useState<WeeklyCheckinRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [pickingTime, setPickingTime] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const active = await getMyActiveWeeklyCheckin();
      setCheckin(active);
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

  const handlePick = async (chosenTime: string) => {
    if (!checkin) return;
    setPickError(null);
    setPickingTime(chosenTime);
    try {
      await selectCheckinTime({ weeklyCheckinId: checkin.id, chosenTime });
      await load();
    } catch (err) {
      setPickError(err instanceof EdgeFunctionError ? err.message : 'Something went wrong.');
    } finally {
      setPickingTime(null);
    }
  };

  if (error) return <ErrorState onRetry={load} />;
  if (checkin === undefined) return <LoadingState />;

  if (!checkin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
        <EmptyState
          title="No weekly check-in scheduled"
          description="Your Builder will propose times here when it's time for your weekly check-in."
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
          Weekly check-in
        </Text>

        {checkin.status === 'scheduled' ? (
          <Card eyebrow="Scheduled" title={new Date(checkin.scheduled_at!).toLocaleString()}>
            <Badge tone="success">Confirmed</Badge>
            {checkin.meet_link ? (
              <Text
                style={{
                  marginTop: theme.space.xs,
                  fontFamily: theme.font.mono,
                  fontSize: theme.type.caption.fontSize,
                  color: theme.colors.textSubtle,
                }}
              >
                {checkin.meet_link}
              </Text>
            ) : null}
          </Card>
        ) : (
          <Card eyebrow="Pick a time" title="Your Builder proposed 3 times">
            {pickError ? (
              <Text
                style={{
                  fontFamily: theme.font.text,
                  fontSize: theme.type.bodySm.fontSize,
                  color: theme.colors.textAttention,
                }}
              >
                {pickError}
              </Text>
            ) : null}
            <View style={{ marginTop: theme.space.sm, gap: theme.space.sm }}>
              {(checkin.proposed_times ?? []).map((time) => (
                <Button
                  key={time}
                  variant="secondary"
                  fullWidth
                  status={pickingTime === time ? 'loading' : 'idle'}
                  disabled={pickingTime !== null}
                  onPress={() => handlePick(time)}
                >
                  {new Date(time).toLocaleString()}
                </Button>
              ))}
            </View>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
