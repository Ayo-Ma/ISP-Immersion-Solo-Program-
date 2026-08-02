import { synchronize } from '@nozbe/watermelondb/sync';

import { supabase } from '../lib/supabase';
import { database } from './index';

/**
 * Phase 1 WatermelonDB sync spike (Standing Risk #2). Talks to the
 * spike-only Edge Function (supabase/functions/watermelon-sync-spike),
 * whose pull/push protocol was verified directly via HTTP in
 * supabase/tests/watermelon-sync-spike.manual.mjs. This file wires the
 * same protocol into WatermelonDB's synchronize() — written and
 * typechecked, not yet exercised on a device (needs a custom dev client
 * build; see docs/WATERMELONDB_SPIKE.md for what remains unverified).
 */

const SYNC_FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/watermelon-sync-spike`;

async function authHeader(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Cannot sync: no authenticated Supabase session.');
  }
  return `Bearer ${session.access_token}`;
}

export async function syncSpikeNotes(): Promise<void> {
  await synchronize({
    database,
    pullChanges: async ({ lastPulledAt }) => {
      const url = new URL(SYNC_FUNCTION_URL);
      if (lastPulledAt != null) {
        url.searchParams.set('last_pulled_at', String(lastPulledAt));
      }

      const response = await fetch(url.toString(), {
        headers: { Authorization: await authHeader() },
      });
      if (!response.ok) {
        throw new Error(`Sync pull failed: ${response.status} ${await response.text()}`);
      }

      const { changes, timestamp } = await response.json();
      return { changes, timestamp };
    },
    pushChanges: async ({ changes, lastPulledAt }) => {
      const response = await fetch(SYNC_FUNCTION_URL, {
        method: 'POST',
        headers: {
          Authorization: await authHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ changes, last_pulled_at: lastPulledAt }),
      });
      if (!response.ok) {
        throw new Error(`Sync push failed: ${response.status} ${await response.text()}`);
      }
    },
  });
}
