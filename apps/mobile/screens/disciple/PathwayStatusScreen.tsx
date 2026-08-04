import { SafeAreaView, Text, View } from 'react-native';
import type { PathwayRequestStatus } from '@isp-app/shared-types';

import { useTheme } from '../../theme';
import type { PathwayRequestRow } from '../../lib/queries/disciple';
import { Badge } from '../../components/Badge';

const STATUS_COPY: Record<
  PathwayRequestStatus,
  { label: string; tone: 'neutral' | 'success' | 'attention'; detail: string }
> = {
  requested: {
    label: 'Under review',
    tone: 'neutral',
    detail: 'Your request has been sent to your Lead Pastor and Supervising Minister.',
  },
  under_review: {
    label: 'Under review',
    tone: 'neutral',
    detail: 'One leader has responded — waiting on the second approval.',
  },
  approved: {
    label: 'Approved',
    tone: 'success',
    detail: "You're in. Loading your pathway now.",
  },
  rejected: {
    label: 'Not approved',
    tone: 'attention',
    detail: 'Talk with your Builder about next steps.',
  },
};

/**
 * PRD Section C.1 fix: "the disciple sees a clear 'Your pathway request is
 * under review' status with an expected turnaround window, instead of a
 * blank or ambiguous screen." The 48-72 hour SLA is the number named in
 * PRD Section E for approval turnaround generally — not restated as a
 * guarantee, since it's explicitly still an open item pending
 * confirmation, not a locked commitment to promise the disciple.
 */
export function PathwayStatusScreen({ request }: { request: PathwayRequestRow }) {
  const theme = useTheme();
  const copy = STATUS_COPY[request.status];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.base.canvas }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space.lg,
          padding: theme.space.xl,
        }}
      >
        <Text
          style={{
            fontFamily: theme.font.textMedium,
            fontSize: theme.identityType.micro.fontSize,
            letterSpacing: theme.identityType.micro.letterSpacing,
            textTransform: 'uppercase',
            color: theme.colors.signalActive,
          }}
        >
          {request.pathways.name}
        </Text>
        <Text
          style={{
            fontFamily: theme.font.display,
            fontSize: theme.identityType.feature.fontSize,
            lineHeight: theme.identityType.feature.lineHeight,
            color: theme.base.ink,
            textAlign: 'center',
          }}
        >
          Your pathway request is {copy.label.toLowerCase()}
        </Text>
        <Badge tone={copy.tone}>{copy.label}</Badge>
        <Text
          style={{
            fontFamily: theme.font.text,
            fontSize: theme.type.body.fontSize,
            color: theme.base.inkMuted,
            textAlign: 'center',
            maxWidth: 320,
          }}
        >
          {copy.detail}
        </Text>
        {request.status === 'rejected' && request.rejection_reason ? (
          <Text
            style={{
              fontFamily: theme.font.text,
              fontSize: theme.type.bodySm.fontSize,
              color: theme.base.inkTertiary,
              textAlign: 'center',
              maxWidth: 320,
            }}
          >
            {request.rejection_reason}
          </Text>
        ) : null}
        {request.status === 'requested' || request.status === 'under_review' ? (
          <Text
            style={{
              fontFamily: theme.font.mono,
              fontSize: theme.type.caption.fontSize,
              color: theme.base.inkTertiary,
            }}
          >
            Typical turnaround: 48–72 hours
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
