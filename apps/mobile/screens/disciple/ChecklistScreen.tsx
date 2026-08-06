import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import {
  getTodayChecklist,
  createTodayChecklist,
  updateChecklistItem,
  submitChecklist,
  type DailyChecklistRow,
} from '../../lib/queries/disciple';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import type { DiscipleStackScreenProps } from '../../navigation/DiscipleNavigator';

const STATUS_TONE: Record<
  DailyChecklistRow['status'],
  'neutral' | 'signal' | 'success' | 'attention'
> = {
  draft: 'neutral',
  pending_review: 'signal',
  approved: 'success',
  needs_redo: 'attention',
};
const STATUS_LABEL: Record<DailyChecklistRow['status'], string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  approved: 'Approved',
  needs_redo: 'Needs redo',
};

/**
 * PRD Section C.3: explicit status states Submitted -> Pending Review ->
 * Approved / Needs Redo, never silence while the disciple waits.
 * class_done/test_done stay simple self-report toggles. prayer_done is
 * read-only here as of Phase 7 — it's set only by actually clocking
 * in/out of a prayer session in Chat (PRD Section E: a bare checkbox
 * wasn't a genuine enough signal), so this screen links there instead of
 * offering a toggle a guard trigger would just reject.
 */
export function ChecklistScreen({ navigation }: DiscipleStackScreenProps<'Checklist'>) {
  const theme = useTheme();
  const [checklist, setChecklist] = useState<DailyChecklistRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const existing = await getTodayChecklist();
      setChecklist(existing ?? (await createTodayChecklist()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Re-check on focus — coming back from Chat after clocking out of
  // prayer should reflect prayer_done flipping to true, not a stale read.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error) return <ErrorState onRetry={load} />;
  if (!checklist) return <LoadingState />;

  const editable = checklist.status === 'draft';

  const toggle = async (key: 'class_done' | 'test_done') => {
    if (!editable || busy) return;
    setBusy(true);
    try {
      setChecklist(await updateChecklistItem(checklist.id, { [key]: !checklist[key] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const allDone = checklist.class_done && checklist.test_done && checklist.prayer_done;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.lg }}>
        <View style={{ gap: theme.space.xs }}>
          <Text
            style={{
              fontFamily: theme.font.display,
              fontSize: theme.type.displayMd.fontSize,
              lineHeight: theme.type.displayMd.lineHeight,
              color: theme.colors.textHeading,
            }}
          >
            Today&apos;s checklist
          </Text>
          <Badge tone={STATUS_TONE[checklist.status]}>{STATUS_LABEL[checklist.status]}</Badge>
        </View>

        {checklist.status === 'needs_redo' && checklist.rejection_reason ? (
          <Card eyebrow="From your Builder" title="Needs redo">
            {checklist.rejection_reason}
          </Card>
        ) : null}

        <View style={{ gap: theme.space.sm }}>
          {(
            [
              ['class_done', 'Class attended'],
              ['test_done', 'Test taken'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={checklist[key] ? 'primary' : 'secondary'}
              fullWidth
              disabled={!editable}
              onPress={() => toggle(key)}
            >
              {(checklist[key] ? '✓ ' : '') + label}
            </Button>
          ))}

          <Card eyebrow="Prayer regimen" title={checklist.prayer_done ? 'Done' : 'Not yet'}>
            <Badge tone={checklist.prayer_done ? 'success' : 'neutral'}>
              {checklist.prayer_done ? 'Clocked out today' : 'Clock in from Chat to log it'}
            </Badge>
            {!checklist.prayer_done ? (
              <View style={{ marginTop: theme.space.sm }}>
                <Button variant="secondary" fullWidth onPress={() => navigation.navigate('Chat')}>
                  Go to Chat
                </Button>
              </View>
            ) : null}
          </Card>
        </View>

        {editable ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!allDone}
            status={busy ? 'loading' : 'idle'}
            onPress={async () => {
              setBusy(true);
              try {
                setChecklist(await submitChecklist(checklist.id));
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Something went wrong.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Submit for review
          </Button>
        ) : (
          <Text
            style={{
              fontFamily: theme.font.text,
              fontSize: theme.type.bodySm.fontSize,
              color: theme.colors.textSubtle,
            }}
          >
            {checklist.status === 'pending_review'
              ? 'Your Builder has not reviewed this yet.'
              : checklist.status === 'approved'
                ? 'Nice work — come back tomorrow.'
                : ''}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
