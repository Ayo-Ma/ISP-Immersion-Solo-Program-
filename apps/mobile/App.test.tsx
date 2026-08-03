import { render } from '@testing-library/react-native';

// This is a render smoke test, not an auth integration test — without this
// mock, AuthContext's real supabase.auth.getSession() call hits the fake
// test URL from jest.setup.js and takes over 2 minutes to time out,
// which is exactly the kind of network-dependent slowness a "unit" test
// must never have.
jest.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  },
}));

import { App } from './App';

// Renders the unwrapped component — Sentry.wrap()'s native touch
// instrumentation (the default export) isn't compatible with the test
// renderer's mocked environment. The wrapper itself is exercised at
// runtime, not in this smoke test.
describe('App', () => {
  it('renders without crashing', async () => {
    const { toJSON } = await render(<App />);
    expect(toJSON()).toBeTruthy();
  });
});
