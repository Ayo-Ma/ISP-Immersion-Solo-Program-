import { Component, type ReactNode } from 'react';
import { SafeAreaView, Text, View } from 'react-native';

import { Sentry } from '../lib/sentry';
import { log } from '@isp-app/logger';
import { useTheme } from '../theme';
import { Button } from './Button';

function ErrorFallback({ onReset }: { onReset: () => void }) {
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surfaceCanvas }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.space.md,
          padding: theme.space.xxl,
        }}
      >
        <Text
          style={{
            fontFamily: theme.font.displayMedium,
            fontSize: theme.type.headline.fontSize,
            color: theme.colors.textHeading,
            textAlign: 'center',
          }}
        >
          Something went wrong
        </Text>
        <Text
          style={{
            fontFamily: theme.font.text,
            fontSize: theme.type.bodySm.fontSize,
            color: theme.colors.textSubtle,
            textAlign: 'center',
          }}
        >
          The app hit an unexpected error. It has been reported.
        </Text>
        <Button variant="primary" onPress={onReset}>
          Try again
        </Button>
      </View>
    </SafeAreaView>
  );
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Phase 3: "Global error boundary + user-facing fallback states (no blank
 * screens on failure)." React error boundaries must be class components —
 * there is no hook equivalent — so the boundary itself stays a plain
 * class and delegates the actual themed UI to a function component.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    log.error('app.uncaught_render_error', {
      context: { message: error.message, componentStack: info.componentStack },
    });
    Sentry.captureException(error);
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReset={this.reset} />;
    }
    return this.props.children;
  }
}
