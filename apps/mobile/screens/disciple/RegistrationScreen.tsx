import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { listPathways, type Pathway } from '../../lib/queries/disciple';
import { createPathwayRequest, EdgeFunctionError } from '../../lib/edgeFunctions';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';
import { ErrorState } from '../../components/ErrorState';

/**
 * PRD Section C.1: "Pre-programmed questionnaire at registration determines
 * a suggested pathway." Neither the PRD nor the Backend System Design
 * specifies the actual questions or a scoring algorithm — that's a real
 * product decision nobody has made yet, not something to invent here.
 * This screen implements the part that IS specified precisely (a pathway
 * request gets created, and the disciple sees why each pathway exists) as
 * a direct, honest choice rather than fabricating quiz logic that would
 * just be theater around the same outcome. Revisit if/when the actual
 * questionnaire content is decided.
 */
export function RegistrationScreen({ onSubmitted }: { onSubmitted: () => void }) {
  const theme = useTheme();
  const [pathways, setPathways] = useState<Pathway[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setPathways(null);
    listPathways()
      .then(setPathways)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(load, []);

  const handleChoose = async (pathwayId: string) => {
    setSubmitError(null);
    setSubmittingId(pathwayId);
    try {
      await createPathwayRequest({ pathwayId });
      onSubmitted();
    } catch (err) {
      setSubmitError(err instanceof EdgeFunctionError ? err.message : 'Something went wrong.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (error) {
    return <ErrorState onRetry={load} />;
  }
  if (!pathways) {
    return <LoadingState />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <ScrollView contentContainerStyle={{ padding: theme.space.xl, gap: theme.space.lg }}>
        <View style={{ gap: theme.space.xs }}>
          <Text
            style={{
              fontFamily: theme.font.textMedium,
              fontSize: theme.type.eyebrow.fontSize,
              letterSpacing: theme.type.eyebrow.letterSpacing,
              textTransform: 'uppercase',
              color: theme.colors.textSubtle,
            }}
          >
            Registration
          </Text>
          <Text
            style={{
              fontFamily: theme.font.display,
              fontSize: theme.type.displayMd.fontSize,
              lineHeight: theme.type.displayMd.lineHeight,
              color: theme.colors.textHeading,
            }}
          >
            Choose your pathway
          </Text>
          <Text
            style={{
              fontFamily: theme.font.text,
              fontSize: theme.type.body.fontSize,
              color: theme.colors.textSubtle,
            }}
          >
            Your Builder and church leadership will review this before you start.
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

        <View style={{ gap: theme.space.md }}>
          {pathways.map((pathway) => (
            <Card key={pathway.id} title={pathway.name} eyebrow="Pathway">
              {pathway.description ?? undefined}
              <View style={{ marginTop: theme.space.sm }}>
                <Button
                  variant="primary"
                  status={submittingId === pathway.id ? 'loading' : 'idle'}
                  disabled={submittingId !== null && submittingId !== pathway.id}
                  onPress={() => handleChoose(pathway.id)}
                >
                  Request this pathway
                </Button>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
