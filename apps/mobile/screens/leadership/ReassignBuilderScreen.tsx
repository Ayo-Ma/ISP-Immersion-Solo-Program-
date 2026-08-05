import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import {
  listActiveDisciples,
  listActiveBuilders,
  type RosterUser,
} from '../../lib/queries/leadership';
import { reassignBuilder, EdgeFunctionError } from '../../lib/edgeFunctions';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Badge } from '../../components/Badge';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';

/** Phase 6: "Builder reassignment admin action (UI for the Phase 2 backend action)." */
export function ReassignBuilderScreen() {
  const theme = useTheme();
  const [disciples, setDisciples] = useState<RosterUser[] | null>(null);
  const [builders, setBuilders] = useState<RosterUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [discipleId, setDiscipleId] = useState<string | null>(null);
  const [newBuilderId, setNewBuilderId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    newBuilderActiveDiscipleCount: number;
    builderExceedsCapacitySoftCap: boolean;
  } | null>(null);

  const load = () => {
    setLoadError(null);
    setDisciples(null);
    setBuilders(null);
    Promise.all([listActiveDisciples(), listActiveBuilders()])
      .then(([d, b]) => {
        setDisciples(d);
        setBuilders(b);
      })
      .catch((err: Error) => setLoadError(err.message));
  };

  useEffect(load, []);

  const handleSubmit = async () => {
    if (!discipleId || !newBuilderId) {
      setSubmitError('Pick a disciple and a new Builder.');
      return;
    }
    if (!reason.trim()) {
      setSubmitError('A reason is required (Section F2 — preserved on the ended pairing).');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    setResult(null);
    try {
      const output = await reassignBuilder({
        discipleId,
        newBuilderId,
        reason: reason.trim(),
      });
      setResult(output);
      setDiscipleId(null);
      setNewBuilderId(null);
      setReason('');
    } catch (err) {
      setSubmitError(err instanceof EdgeFunctionError ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) return <ErrorState onRetry={load} />;
  if (!disciples || !builders) return <LoadingState />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.lg }}>
        {result ? (
          <Card eyebrow="Reassigned" title="Done">
            <Badge tone={result.builderExceedsCapacitySoftCap ? 'attention' : 'success'}>
              New Builder now has {result.newBuilderActiveDiscipleCount} active disciple
              {result.newBuilderActiveDiscipleCount === 1 ? '' : 's'}
              {result.builderExceedsCapacitySoftCap ? ' — over the 8-12 soft cap' : ''}
            </Badge>
          </Card>
        ) : null}

        <Card eyebrow="Step 1" title="Disciple">
          <View style={{ marginTop: theme.space.sm, gap: theme.space.xs }}>
            {disciples.map((disciple) => (
              <RosterRow
                key={disciple.id}
                user={disciple}
                selected={discipleId === disciple.id}
                onPress={() => setDiscipleId(disciple.id)}
              />
            ))}
          </View>
        </Card>

        <Card eyebrow="Step 2" title="New Builder">
          <View style={{ marginTop: theme.space.sm, gap: theme.space.xs }}>
            {builders.map((builder) => (
              <RosterRow
                key={builder.id}
                user={builder}
                selected={newBuilderId === builder.id}
                onPress={() => setNewBuilderId(builder.id)}
              />
            ))}
          </View>
        </Card>

        <Input
          label="Reason"
          placeholder="Why is this disciple being reassigned?"
          value={reason}
          onChangeText={setReason}
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
          onPress={handleSubmit}
        >
          Reassign
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

function RosterRow({
  user,
  selected,
  onPress,
}: {
  user: RosterUser;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Card variant={selected ? 'featured' : 'default'} padding="compact" onPress={onPress}>
      {user.name}
      {selected ? (
        <View style={{ marginTop: 4 }}>
          <Badge tone="signal">Selected</Badge>
        </View>
      ) : null}
    </Card>
  );
}
