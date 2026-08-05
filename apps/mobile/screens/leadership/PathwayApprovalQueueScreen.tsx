import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useAuth } from '../../lib/AuthContext';
import {
  listPathwayApprovalQueue,
  approvePathwayRequest,
  rejectPathwayRequest,
  type PathwayApprovalRow,
  type LeadershipRole,
} from '../../lib/queries/leadership';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import { EmptyState } from '../../components/EmptyState';

/** Phase 6: "Pathway approval queue (parallel approval, not sequential)." */
export function PathwayApprovalQueueScreen() {
  const theme = useTheme();
  const { profile } = useAuth();
  const role = profile!.role as LeadershipRole;
  const [queue, setQueue] = useState<PathwayApprovalRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setQueue(await listPathwayApprovalQueue(role));
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
          description="No pathway requests waiting on your approval."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.md }}>
        {queue.map((request) => (
          <PathwayRequestCard key={request.id} request={request} role={role} onActed={load} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function PathwayRequestCard({
  request,
  role,
  onActed,
}: {
  request: PathwayApprovalRow;
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
      await approvePathwayRequest(request.id, role);
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
      await rejectPathwayRequest(request.id, rejectionReason.trim());
      onActed();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(null);
    }
  };

  const alreadyOtherApproved =
    (role === 'supervising_minister' && request.lp_approved_at) ||
    (role === 'lead_pastor' && request.sm_approved_at);

  return (
    <Card eyebrow={request.pathways.name} title={request.users.name}>
      {alreadyOtherApproved ? (
        <Text
          style={{
            fontFamily: theme.font.text,
            fontSize: theme.type.caption.fontSize,
            color: theme.colors.textSubtle,
          }}
        >
          {role === 'supervising_minister' ? 'Lead Pastor' : 'Supervising Minister'} already
          approved — your decision finalizes this.
        </Text>
      ) : null}

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

      {showReject ? (
        <View style={{ marginTop: theme.space.sm, gap: theme.space.sm }}>
          <Input
            label="Reason for rejecting"
            placeholder="Why isn't this ready to approve?"
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
              Approve
            </Button>
          </View>
        </View>
      )}
    </Card>
  );
}
