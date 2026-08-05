import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useAuth } from '../../lib/AuthContext';
import {
  listGraduationApprovalQueue,
  approveGraduationRequest,
  rejectGraduationRequest,
  type GraduationApprovalRow,
  type LeadershipRole,
} from '../../lib/queries/leadership';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';

/** Phase 6: "Graduation approval queue (sequential, enforced)." */
export function GraduationApprovalQueueScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const role = profile!.role as LeadershipRole;
  const [queue, setQueue] = useState<GraduationApprovalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setQueue(await listGraduationApprovalQueue(role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, [role]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (error) return <ErrorState onRetry={load} />;
  if (!queue) return <LoadingState />;

  if (queue.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
        <EmptyState
          title="Queue clear"
          description="No graduation requests waiting on your step."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.md }}>
        {queue.map((request) => (
          <GraduationRequestCard key={request.id} request={request} role={role} onActed={load} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function GraduationRequestCard({
  request,
  role,
  onActed,
}: {
  request: GraduationApprovalRow;
  role: LeadershipRole;
  onActed: () => void;
}) {
  const theme = useTheme();
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleApprove = async () => {
    setSubmitError(null);
    setSubmitting('approve');
    try {
      await approveGraduationRequest(request.id, role);
      onActed();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setSubmitError('A reason is required to reject this request.');
      return;
    }
    setSubmitError(null);
    setSubmitting('reject');
    try {
      await rejectGraduationRequest(request.id, rejectionReason.trim());
      onActed();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <Card eyebrow={request.enrollments.pathways.name} title={request.enrollments.users.name}>
      <Badge tone="signal">
        {role === 'supervising_minister' ? 'Awaiting your review' : 'Awaiting final approval'}
      </Badge>

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

      {showReject ? (
        <View style={{ marginTop: theme.space.sm, gap: theme.space.sm }}>
          <Input
            label="Reason for rejecting"
            placeholder={`Routes back to ${role === 'supervising_minister' ? 'the Builder' : 'the Supervising Minister'}`}
            value={rejectionReason}
            onChangeText={setRejectionReason}
          />
          <View style={{ flexDirection: 'row', gap: theme.space.sm }}>
            <View style={{ flex: 1 }}>
              <Button
                variant="secondary"
                fullWidth
                disabled={submitting !== null}
                onPress={() => setShowReject(false)}
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
                Reject
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
              onPress={() => setShowReject(true)}
            >
              Reject
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
              {role === 'supervising_minister' ? 'Approve' : 'Approve — finalize graduation'}
            </Button>
          </View>
        </View>
      )}
    </Card>
  );
}
