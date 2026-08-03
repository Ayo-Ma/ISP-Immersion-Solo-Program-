// Jest doesn't load .env the way Expo's CLI/Metro does, so
// EXPO_PUBLIC_SUPABASE_URL/ANON_KEY are unset under `jest` unless real
// values happen to already be in the process env. lib/supabase.ts throws
// on import if they're missing (correct for real app startup — fail fast
// on real misconfiguration), which would otherwise break every test that
// imports anything touching Supabase, even pure-render smoke tests that
// never make a network call. These are placeholders, never real secrets.
process.env.EXPO_PUBLIC_SUPABASE_URL ||= 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';
