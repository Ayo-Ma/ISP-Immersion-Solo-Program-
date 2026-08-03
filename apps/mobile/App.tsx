import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts as useInstrumentSans,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from '@expo-google-fonts/instrument-sans';
import {
  useFonts as useIbmPlexSans,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
} from '@expo-google-fonts/ibm-plex-sans';
import {
  useFonts as useIbmPlexMono,
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';

import { initSentry, Sentry } from './lib/sentry';
import { ThemeProvider } from './theme';
import { AuthProvider } from './lib/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingState } from './components/LoadingState';
import { RootNavigator } from './navigation/RootNavigator';

initSentry();

export function App() {
  const [displayLoaded] = useInstrumentSans({
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
  });
  const [textLoaded] = useIbmPlexSans({ IBMPlexSans_400Regular, IBMPlexSans_500Medium });
  const [monoLoaded] = useIbmPlexMono({ IBMPlexMono_400Regular, IBMPlexMono_500Medium });
  const fontsReady = displayLoaded && textLoaded && monoLoaded;

  if (!fontsReady) {
    // useTheme()'s context default is darkTheme (see theme/index.tsx), so
    // LoadingState renders correctly even without a mounted ThemeProvider
    // here — and dark is the right default anyway, since the design
    // system is dark-first.
    return (
      <SafeAreaProvider>
        <LoadingState />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ErrorBoundary>
        <StatusBar style="light" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
