import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { supabase } from '../../lib/supabase';
import type { ModuleProgressRow } from '../../lib/queries/disciple';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import type { DiscipleStackScreenProps } from '../../navigation/DiscipleNavigator';

/**
 * Video is a YouTube/Vimeo embed per the PRD, not self-hosted — this
 * screen links out to the video rather than embedding a player, since a
 * real in-app embed is a Phase 4 UI-polish concern, not what the Gate
 * ("complete a module") actually tests. clock_in_at is disciple-writable
 * directly (Phase 1/2 RLS — not locked behind an Edge Function, unlike
 * grading fields), so this screen writes it straight to the table.
 */
export function LessonScreen({ route, navigation }: DiscipleStackScreenProps<'Lesson'>) {
  const theme = useTheme();
  const { moduleProgressId } = route.params;
  const [progress, setProgress] = useState<ModuleProgressRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setProgress(null);
    supabase
      .from('module_progress')
      .select(
        'id, enrollment_id, module_id, clock_in_at, clock_out_at, test_score, attempts, status, rewatch_required, rewatched_at, cooldown_until, failed_at, modules(id, pathway_id, order_index, title, video_url, notes)',
      )
      .eq('id', moduleProgressId)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError(fetchError.message);
          return;
        }
        setProgress(data as unknown as ModuleProgressRow);
        if (!data.clock_in_at) {
          supabase
            .from('module_progress')
            .update({ clock_in_at: new Date().toISOString() })
            .eq('id', moduleProgressId)
            .then(() => {});
        }
      });
  };

  useEffect(load, [moduleProgressId]);

  if (error) return <ErrorState onRetry={load} />;
  if (!progress) return <LoadingState />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.lg }}>
        <Text
          style={{
            fontFamily: theme.font.display,
            fontSize: theme.type.headline.fontSize,
            color: theme.colors.textHeading,
          }}
        >
          {progress.modules.title}
        </Text>

        {progress.rewatch_required &&
        (!progress.rewatched_at ||
          (progress.failed_at && progress.rewatched_at <= progress.failed_at)) ? (
          <Card eyebrow="Before you retake the test" title="Rewatch required">
            Your last attempt did not pass. Rewatch this lesson, then mark it below before retaking
            the test.
          </Card>
        ) : null}

        <Card
          eyebrow="Video"
          title={progress.modules.video_url ? 'Lesson video' : 'No video attached'}
        >
          {progress.modules.video_url ?? 'Ask your Builder if this looks wrong.'}
        </Card>

        {progress.modules.notes ? (
          <Card eyebrow="Notes" title="Lesson notes">
            {progress.modules.notes}
          </Card>
        ) : null}

        <View style={{ gap: theme.space.sm }}>
          {progress.rewatch_required ? (
            <Button
              variant="secondary"
              fullWidth
              onPress={() => {
                supabase
                  .from('module_progress')
                  .update({ rewatched_at: new Date().toISOString() })
                  .eq('id', progress.id)
                  .then(() => load());
              }}
            >
              Mark as rewatched
            </Button>
          ) : null}
          <Button
            variant="primary"
            fullWidth
            onPress={() => navigation.navigate('Test', { moduleProgressId })}
          >
            {progress.status === 'passed' ? 'Review test' : 'Take the test'}
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
