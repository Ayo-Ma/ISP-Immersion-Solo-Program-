import { useEffect, useState } from 'react';
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
 * Approved / Needs Redo, never silence while the disciple waits. Prayer
 * regimen is a self-report, same trust model the design rulebook uses
 * throughout (a Builder can't actually verify sincerity remotely) — this
 * checkbox is "I did this," not a claim anyone is fact-checking.
 */
export function ChecklistScreen() {
  const theme = useTheme();
  const [checklist, setChecklist] = useState<DailyChecklistRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    setChecklist(null);
    try {
      const existing = await getTodayChecklist();
      setChecklist(existing ?? (await createTodayChecklist()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorState onRetry={load} />;
  if (!checklist) return <LoadingState />;

  const editable = checklist.status === 'draft';

  const toggle = async (key: 'class_done' | 'test_done' | 'prayer_done') => {
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
              ['prayer_done', 'Prayer regimen'],
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
