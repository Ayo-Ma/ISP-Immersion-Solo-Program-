import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import {
  getOrgStats,
  listAtRiskDisciples,
  type OrgStats,
  type AtRiskDisciple,
} from '../../lib/queries/leadership';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';
import type { LeadershipStackScreenProps } from '../../navigation/LeadershipNavigator';

/** Phase 6: "Org-wide reporting dashboard (basic: active disciples, pending approvals, at-risk disciples)." */
export function LeadershipDashboardScreen({
  navigation,
}: LeadershipStackScreenProps<'LeadershipDashboard'>) {
  const theme = useTheme();
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [atRisk, setAtRisk] = useState<AtRiskDisciple[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [orgStats, atRiskList] = await Promise.all([getOrgStats(), listAtRiskDisciples()]);
      setStats(orgStats);
      setAtRisk(atRiskList);
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

  if (error) return <ErrorState onRetry={load} />;
  if (!stats || !atRisk) return <LoadingState />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.lg }}>
        <View style={{ flexDirection: 'row', gap: theme.space.md }}>
          <View style={{ flex: 1 }}>
            <Card eyebrow="Active" title={String(stats.activeDisciples)}>
              Disciples
            </Card>
          </View>
          <View style={{ flex: 1 }}>
            <Card
              eyebrow="Pending"
              title={String(stats.pendingPathwayApprovals + stats.pendingGraduationApprovals)}
            >
              Approvals waiting
            </Card>
          </View>
        </View>

        <View style={{ gap: theme.space.sm }}>
          <Button variant="primary" fullWidth onPress={() => navigation.navigate('PathwayQueue')}>
            Pathway approvals ({stats.pendingPathwayApprovals})
          </Button>
          <Button
            variant="primary"
            fullWidth
            onPress={() => navigation.navigate('GraduationQueue')}
          >
            Graduation approvals ({stats.pendingGraduationApprovals})
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onPress={() => navigation.navigate('BuilderCapacity')}
          >
            Builder capacity
          </Button>
          <Button variant="secondary" fullWidth onPress={() => navigation.navigate('Digest')}>
            Daily digest
          </Button>
          <Button
            variant="tertiary"
            fullWidth
            onPress={() => navigation.navigate('ReassignBuilder')}
          >
            Reassign a Builder
          </Button>
        </View>

        <Card
          eyebrow="At risk"
          title={`${atRisk.length} disciple${atRisk.length === 1 ? '' : 's'}`}
        >
          {atRisk.length === 0 ? (
            'Nobody is 3+ days inactive right now.'
          ) : (
            <View style={{ marginTop: theme.space.sm, gap: theme.space.sm }}>
              {atRisk.map((disciple) => (
                <View
                  key={disciple.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: theme.font.text,
                      fontSize: theme.type.bodySm.fontSize,
                      color: theme.colors.textBody,
                    }}
                  >
                    {disciple.name}
                  </Text>
                  <Badge tone="attention">
                    {disciple.daysSinceLastChecklist === null
                      ? 'No activity yet'
                      : `${disciple.daysSinceLastChecklist}d inactive`}
                  </Badge>
                </View>
              ))}
            </View>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
