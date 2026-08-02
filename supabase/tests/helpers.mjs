// Shared helpers for the RLS test suite (Standing Risk #1: RLS must be
// tested automatically as each table ships). Runs against the real
// isp-app-dev project — see docs/SETUP.md for why (no local Docker
// available), and .env for credentials.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_DEV_URL;
const SECRET_KEY = process.env.SUPABASE_DEV_SECRET_KEY;
const PUBLISHABLE_KEY = process.env.SUPABASE_DEV_PUBLISHABLE_KEY;

for (const [name, value] of Object.entries({
  SUPABASE_DEV_URL: SUPABASE_URL,
  SUPABASE_DEV_SECRET_KEY: SECRET_KEY,
  SUPABASE_DEV_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
})) {
  if (!value) {
    throw new Error(`${name} must be set (see .env) to run the RLS test suite.`);
  }
}

export const EMAIL_DOMAIN = 'seed.isp-app.test';
export const SEED_PASSWORD = 'Seed-Dev-Only-Password-1!';

export const SEED_KEYS = [
  'lead_pastor',
  'supervising_minister',
  'builder_1',
  'builder_2',
  'disciple_1',
  'disciple_2',
  'disciple_3',
  'disciple_4',
  'disciple_5',
  'disciple_6',
];

export function emailFor(key) {
  return `${key.replace(/_/g, '.')}@${EMAIL_DOMAIN}`;
}

// Bypasses RLS entirely — used only for fixture setup/teardown and for
// looking up seeded user IDs, never for the assertions themselves.
export const adminClient = createClient(SUPABASE_URL, SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// This sandbox's network occasionally drops the first request of a test
// run with a transient fetch failure (seen repeatedly against both the
// Auth API and the Management API, always transient, always succeeds on
// retry) — retrying a couple of times here means a real, reproducible
// failure still surfaces immediately, instead of every test file needing
// a human to notice "fetch failed" and re-run it by hand.
async function withRetry(fn, attempts = 5) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw lastError;
}

export async function loadSeedUserIds() {
  const { data, error } = await withRetry(() =>
    adminClient.auth.admin.listUsers({ perPage: 1000 }),
  );
  if (error) throw error;

  const ids = {};
  for (const key of SEED_KEYS) {
    const email = emailFor(key);
    const user = data.users.find((u) => u.email === email);
    if (!user) {
      throw new Error(
        `Seed user ${key} (${email}) not found — run: node --env-file=.env supabase/seed/seed.mjs`,
      );
    }
    ids[key] = user.id;
  }
  return ids;
}

// A fresh, unauthenticated-until-signed-in client per role — mirrors how
// the real mobile app talks to Supabase (anon/publishable key + a user's
// session), which is exactly what RLS policies are evaluated against.
export async function signInAs(key) {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await withRetry(() =>
    client.auth.signInWithPassword({
      email: emailFor(key),
      password: SEED_PASSWORD,
    }),
  );
  if (error) throw new Error(`Sign-in failed for ${key}: ${error.message}`);
  return client;
}
