import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { supabase } from '../../lib/supabase';
import { recordTestAttempt, EdgeFunctionError } from '../../lib/edgeFunctions';
import type { ModuleProgressRow } from '../../lib/queries/disciple';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import type { DiscipleStackScreenProps } from '../../navigation/DiscipleNavigator';

/**
 * No question bank exists in this schema (no table for per-module test
 * questions, and Content/Curriculum Admin — who'd own authoring one — is
 * still an unconfirmed role per PRD Section E). Rather than invent quiz
 * content nobody has specified, this screen implements the part that IS
 * fully specified: submitting an attempt, and the retake gating around it
 * (rewatch required, cooldown, 3-strikes alert) — exactly what Phase 4's
 * Gate actually tests ("fail and retake a test, rewatch-gated,
 * cooldown-enforced"). Score entry stands in for wherever the real test
 * ends up being administered.
 */
export function TestScreen({ route, navigation }: DiscipleStackScreenProps<'Test'>) {
  const theme = useTheme();
  const { moduleProgressId } = route.params;
  const [progress, setProgress] = useState<ModuleProgressRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    status: 'passed' | 'failed';
    builderAlerted: boolean;
  } | null>(null);

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
        if (fetchError) setError(fetchError.message);
        else setProgress(data as unknown as ModuleProgressRow);
      });
  };

  useEffect(load, [moduleProgressId]);

  const cooldownActive =
    !!progress?.cooldown_until && new Date(progress.cooldown_until) > new Date();

  const handleSubmit = async () => {
    const parsed = Number(score);
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      setSubmitError('Enter a score between 0 and 100.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const output = await recordTestAttempt({ moduleProgressId, score: parsed });
      setResult({ status: output.status, builderAlerted: output.builderAlerted });
    } catch (err) {
      setSubmitError(err instanceof EdgeFunctionError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <ErrorState onRetry={load} />;
  if (!progress) return <LoadingState />;

  if (result) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.space.lg,
            padding: theme.space.xl,
          }}
        >
          <Badge tone={result.status === 'passed' ? 'success' : 'attention'}>
            {result.status === 'passed' ? 'Passed' : 'Not this time'}
          </Badge>
          <Text
            style={{
              fontFamily: theme.font.display,
              fontSize: theme.type.headline.fontSize,
              color: theme.colors.textHeading,
              textAlign: 'center',
            }}
          >
            {result.status === 'passed' ? "You're through" : 'Rewatch and try again'}
          </Text>
          {result.builderAlerted ? (
            <Text
              style={{
                fontFamily: theme.font.text,
                fontSize: theme.type.bodySm.fontSize,
                color: theme.colors.textSubtle,
                textAlign: 'center',
              }}
            >
              Your Builder has been notified to check in with you.
            </Text>
          ) : null}
          <Button variant="primary" onPress={() => navigation.goBack()}>
            Back to lesson
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  const blockedReason = cooldownActive
    ? `Retake unlocks ${new Date(progress.cooldown_until!).toLocaleTimeString()}.`
    : progress.rewatch_required &&
        (!progress.rewatched_at ||
          (progress.failed_at && progress.rewatched_at <= progress.failed_at))
      ? 'Rewatch the lesson before retaking (go back to mark it rewatched).'
      : null;

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
          {progress.modules.title} — Test
        </Text>

        <Card eyebrow="Pass mark" title="65%">
          {progress.attempts > 0
            ? `Attempt ${progress.attempts + 1} — previous attempts: ${progress.attempts}`
            : 'First attempt'}
        </Card>

        {blockedReason ? (
          <Card eyebrow="Not yet" title="Retake locked">
            {blockedReason}
          </Card>
        ) : (
          <View style={{ gap: theme.space.md }}>
            <Input
              label="Your score"
              placeholder="0–100"
              value={score}
              onChangeText={setScore}
              keyboardType="numeric"
              error={submitError ?? undefined}
            />
            <Button
              variant="primary"
              fullWidth
              status={submitting ? 'loading' : 'idle'}
              onPress={handleSubmit}
            >
              Submit test
            </Button>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
