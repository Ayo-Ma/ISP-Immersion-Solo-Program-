import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useAuth } from '../../lib/AuthContext';
import {
  listPendingReviewChecklists,
  listEligibleGraduationRequests,
  listWeeklyCheckins,
  recommendGraduation,
  proposeCheckinTimes,
  submitCheckinReport,
  type ChecklistForReview,
  type EligibleGraduationRequest,
  type WeeklyCheckinRow,
} from '../../lib/queries/builder';
import { reviewChecklist, EdgeFunctionError } from '../../lib/edgeFunctions';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import type { BuilderStackScreenProps } from '../../navigation/BuilderNavigator';

/**
 * Phase 5: checklist review (the Gate), graduation recommendation, and the
 * weekly check-in propose/report flow, all scoped to one disciple. One
 * screen rather than three separate routes — these are all "things a
 * Builder does about a specific disciple," not independent flows with
 * their own navigation state.
 */
export function DiscipleDetailScreen({ route }: BuilderStackScreenProps<'DiscipleDetail'>) {
  const theme = useTheme();
  const { profile } = useAuth();
  const { discipleId } = route.params;

  const [checklist, setChecklist] = useState<ChecklistForReview | null>(null);
  const [graduationRequest, setGraduationRequest] = useState<EligibleGraduationRequest | null>(
    null,
  );
  const [checkin, setCheckin] = useState<WeeklyCheckinRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [checklists, graduationRequests, checkins] = await Promise.all([
        listPendingReviewChecklists(),
        listEligibleGraduationRequests(),
        listWeeklyCheckins(),
      ]);
      setChecklist(checklists.find((c) => c.disciple_id === discipleId) ?? null);
      setGraduationRequest(
        graduationRequests.find((g) => g.enrollments.disciple_id === discipleId) ?? null,
      );
      setCheckin(
        checkins.find(
          (c) =>
            c.disciple_id === discipleId && (c.status === 'proposed' || c.status === 'scheduled'),
        ) ?? null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [discipleId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error) return <ErrorState onRetry={load} />;
  if (loading) return <LoadingState />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.lg }}>
        {checklist ? (
          <ChecklistReviewCard checklist={checklist} onReviewed={load} />
        ) : (
          <Card eyebrow="Daily checklist" title="Nothing pending">
            No checklist awaiting your review right now.
          </Card>
        )}

        {graduationRequest ? (
          <GraduationCard graduationRequest={graduationRequest} onRecommended={load} />
        ) : null}

        <WeeklyCheckinCard
          discipleId={discipleId}
          builderId={profile!.id}
          checkin={checkin}
          onChanged={load}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ChecklistReviewCard({
  checklist,
  onReviewed,
}: {
  checklist: ChecklistForReview;
  onReviewed: () => void;
}) {
  const theme = useTheme();
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleApprove = async () => {
    setSubmitError(null);
    setSubmitting('approve');
    try {
      await reviewChecklist({ checklistId: checklist.id, decision: 'approved' });
      onReviewed();
    } catch (err) {
      setSubmitError(err instanceof EdgeFunctionError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setSubmitError('A reason is required to send this back (PRD Section C.3).');
      return;
    }
    setSubmitError(null);
    setSubmitting('reject');
    try {
      await reviewChecklist({
        checklistId: checklist.id,
        decision: 'needs_redo',
        rejectionReason: rejectionReason.trim(),
      });
      onReviewed();
    } catch (err) {
      setSubmitError(err instanceof EdgeFunctionError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Card eyebrow="Daily checklist" title={checklist.date}>
      <Badge tone="attention">Pending your review</Badge>
      <View style={{ marginTop: theme.space.sm, gap: theme.space.xs }}>
        <Text style={{ fontFamily: theme.font.text, fontSize: theme.type.bodySm.fontSize }}>
          Class: {checklist.class_done ? 'Done' : 'Not done'} · Test:{' '}
          {checklist.test_done ? 'Done' : 'Not done'} · Prayer:{' '}
          {checklist.prayer_done ? 'Done' : 'Not done'}
        </Text>
      </View>

      {submitError ? (
        <Text
          style={{
            fontFamily: theme.font.text,
            fontSize: theme.type.bodySm.fontSize,
            color: theme.colors.textAttention,
          }}
        >
          {submitError}
        </Text>
      ) : null}

      {showRejectInput ? (
        <View style={{ marginTop: theme.space.sm, gap: theme.space.sm }}>
          <Input
            label="Reason for sending back"
            placeholder="What needs to be redone?"
            value={rejectionReason}
            onChangeText={setRejectionReason}
          />
          <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                fullWidth
                onPress={() => setShowRejectInput(false)}
                disabled={submitting !== null}
              >
                Cancel
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant="primary"
                fullWidth
                status={submitting === 'reject' ? 'loading' : 'idle'}
                disabled={submitting !== null}
                onPress={handleReject}
              >
                Send back
              </Button>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ marginTop: theme.space.sm, flexDirection: 'row', gap: theme.space.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              variant="secondary"
              fullWidth
              disabled={submitting !== null}
              onPress={() => setShowRejectInput(true)}
            >
              Needs redo
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="primary"
              fullWidth
              status={submitting === 'approve' ? 'loading' : 'idle'}
              disabled={submitting !== null}
              onPress={handleApprove}
            >
              Approve
            </Button>
          </View>
        </View>
      )}
    </Card>
  );
}

function GraduationCard({
  graduationRequest,
  onRecommended,
}: {
  graduationRequest: EligibleGraduationRequest;
  onRecommended: () => void;
}) {
  const theme = useTheme();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleRecommend = async () => {
    setSubmitError(null);
    setSubmitting(true);
    try {
      await recommendGraduation(graduationRequest.id);
      onRecommended();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card eyebrow="Graduation" title={graduationRequest.enrollments.pathways.name}>
      <Badge tone="signal">Eligible</Badge>
      {submitError ? (
        <Text
          style={{
            marginTop: theme.space.xs,
            fontFamily: theme.font.text,
            fontSize: theme.type.bodySm.fontSize,
            color: theme.colors.textAttention,
          }}
        >
          {submitError}
        </Text>
      ) : null}
      <View style={{ marginTop: theme.space.sm }}>
        <Button
          variant="primary"
          fullWidth
          status={submitting ? 'loading' : 'idle'}
          onPress={handleRecommend}
        >
          Recommend for graduation
        </Button>
      </View>
    </Card>
  );
}

function parseDateTimeInput(text: string): Date | null {
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function WeeklyCheckinCard({
  discipleId,
  builderId,
  checkin,
  onChanged,
}: {
  discipleId: string;
  builderId: string;
  checkin: WeeklyCheckinRow | null;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const [time1, setTime1] = useState('');
  const [time2, setTime2] = useState('');
  const [time3, setTime3] = useState('');
  const [meetLink, setMeetLink] = useState('');
  const [report, setReport] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handlePropose = async () => {
    const parsed = [time1, time2, time3].map(parseDateTimeInput);
    if (parsed.some((d) => d === null) || !meetLink.trim()) {
      setSubmitError('Enter all 3 times (e.g. 2026-08-12T15:00) and a meet link.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await proposeCheckinTimes({
        builderId,
        discipleId,
        proposedTimes: parsed.map((d) => d!.toISOString()) as [string, string, string],
        meetLink: meetLink.trim(),
      });
      onChanged();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!report.trim()) {
      setSubmitError('Enter a report before submitting.');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitCheckinReport(checkin!.id, report.trim());
      onChanged();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!checkin) {
    return (
      <Card eyebrow="Weekly check-in" title="Propose 3 times">
        <View style={{ gap: theme.space.sm }}>
          <Input
            label="Option 1"
            placeholder="2026-08-12T15:00"
            value={time1}
            onChangeText={setTime1}
          />
          <Input
            label="Option 2"
            placeholder="2026-08-13T10:00"
            value={time2}
            onChangeText={setTime2}
          />
          <Input
            label="Option 3"
            placeholder="2026-08-14T18:00"
            value={time3}
            onChangeText={setTime3}
          />
          <Input
            label="Google Meet link"
            placeholder="https://meet.google.com/..."
            value={meetLink}
            onChangeText={setMeetLink}
            autoCapitalize="none"
          />
          {submitError ? (
            <Text
              style={{
                fontFamily: theme.font.text,
                fontSize: theme.type.bodySm.fontSize,
                color: theme.colors.textAttention,
              }}
            >
              {submitError}
            </Text>
          ) : null}
          <Button
            variant="primary"
            fullWidth
            status={submitting ? 'loading' : 'idle'}
            onPress={handlePropose}
          >
            Send times to disciple
          </Button>
        </View>
      </Card>
    );
  }

  if (checkin.status === 'proposed') {
    return (
      <Card eyebrow="Weekly check-in" title="Waiting on disciple">
        <Badge tone="neutral">Proposed — not yet picked</Badge>
        <Text
          style={{
            marginTop: theme.space.xs,
            fontFamily: theme.font.text,
            fontSize: theme.type.bodySm.fontSize,
            color: theme.colors.textSubtle,
          }}
        >
          {(checkin.proposed_times ?? []).length} times sent, none picked yet.
        </Text>
      </Card>
    );
  }

  return (
    <Card eyebrow="Weekly check-in" title="Scheduled">
      <Badge tone="success">
        {checkin.scheduled_at ? new Date(checkin.scheduled_at).toLocaleString() : 'Scheduled'}
      </Badge>
      <View style={{ marginTop: theme.space.sm, gap: theme.space.sm }}>
        <Input
          label="Post-call report"
          placeholder="How did the check-in go?"
          value={report}
          onChangeText={setReport}
          multiline
        />
        {submitError ? (
          <Text
            style={{
              fontFamily: theme.font.text,
              fontSize: theme.type.bodySm.fontSize,
              color: theme.colors.textAttention,
            }}
          >
            {submitError}
          </Text>
        ) : null}
        <Button
          variant="primary"
          fullWidth
          status={submitting ? 'loading' : 'idle'}
          onPress={handleSubmitReport}
        >
          Submit report
        </Button>
      </View>
    </Card>
  );
}
