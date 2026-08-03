import { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useTheme } from '../../theme';
import { useAuth } from '../../lib/AuthContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

/**
 * Identity mode (design system readme: splash/login = arrival, black
 * canvas, one monumental statement, gold used once). Sign-in only — the
 * roadmap's registration/questionnaire flow is Phase 4 (Disciple
 * Experience), and roles here are admin-invited, never self-registered
 * (Phase 1: public self-signup is disabled at the Supabase Auth level).
 */
export function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');

  const handleSubmit = async () => {
    setError(undefined);
    setStatus('loading');
    const { error: signInError } = await signIn(email.trim(), password);
    setStatus('idle');
    if (signInError) {
      setError('Check your email and password and try again.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.base.canvas }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            padding: theme.space.xl,
            gap: theme.space.xxl,
          }}
        >
          <View style={{ gap: theme.space.sm }}>
            <Text
              style={{
                fontFamily: theme.font.textMedium,
                fontSize: theme.identityType.micro.fontSize,
                letterSpacing: theme.identityType.micro.letterSpacing,
                textTransform: 'uppercase',
                color: theme.colors.signalActive,
              }}
            >
              ISP
            </Text>
            <Text
              style={{
                fontFamily: theme.font.display,
                fontSize: theme.identityType.md.fontSize,
                lineHeight: theme.identityType.md.lineHeight,
                letterSpacing: theme.identityType.md.letterSpacing,
                color: theme.base.ink,
                textTransform: 'uppercase',
              }}
            >
              Sign in
            </Text>
          </View>

          <View style={{ gap: theme.space.md }}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@church.org"
              keyboardType="email-address"
              autoCapitalize="none"
              testID="login-email"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              error={error}
              testID="login-password"
            />
            <Button
              variant="primary"
              size="lg"
              fullWidth
              status={status === 'loading' ? 'loading' : 'idle'}
              onPress={handleSubmit}
              testID="login-submit"
            >
              Sign in
            </Button>
          </View>

          <Text
            style={{
              fontFamily: theme.font.text,
              fontSize: theme.type.caption.fontSize,
              color: theme.base.inkTertiary,
              textAlign: 'center',
            }}
          >
            Accounts are set up by your Builder or church leadership.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
