import { render } from '@testing-library/react-native';

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
