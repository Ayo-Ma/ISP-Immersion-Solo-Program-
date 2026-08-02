// Manual verification script for the WatermelonDB sync spike (Standing
// Risk #2) — exercises the real deployed Edge Function
// (supabase/functions/watermelon-sync-spike) exactly as WatermelonDB's
// synchronize() would: pull baseline, push a create, pull since cursor
// (expect created), push an update, pull since cursor (expect updated not
// created), push a delete, pull since cursor (expect tombstone), and two
// RLS boundary checks.
//
// Not part of the automated RLS suite (rls.test.mjs) — this is a one-off
// spike verification, not a regression test to run on every change.
//
// Usage: node --env-file=.env supabase/tests/watermelon-sync-spike.manual.mjs

import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_DEV_URL;
const PUBLISHABLE_KEY = process.env.SUPABASE_DEV_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_DEV_SECRET_KEY;
const FN_URL = `${SUPABASE_URL}/functions/v1/watermelon-sync-spike`;

async function signIn(email) {
  const client = createClient(SUPABASE_URL, PUBLISHABLE_KEY);
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: 'Seed-Dev-Only-Password-1!',
  });
  if (error) throw error;
  return data.session.access_token;
}

async function pull(token, lastPulledAt) {
  const url = new URL(FN_URL);
  if (lastPulledAt != null) url.searchParams.set('last_pulled_at', String(lastPulledAt));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json();
  if (!res.ok) throw new Error(`pull failed (${res.status}): ${JSON.stringify(body)}`);
  return body;
}

async function push(token, changes, lastPulledAt) {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes, last_pulled_at: lastPulledAt }),
  });
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  const disciple1Token = await signIn('disciple.1@seed.isp-app.test');
  const disciple2Token = await signIn('disciple.2@seed.isp-app.test');
  const admin = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('1. First pull (empty baseline)...');
  const first = await pull(disciple1Token, null);
  const cursor1 = first.timestamp;
  console.log('   OK — got baseline, cursor =', cursor1);

  console.log('2. Push a new note (simulating a local WatermelonDB create)...');
  const noteId = randomUUID();
  const createResult = await push(
    disciple1Token,
    { spike_sync_notes: { created: [{ id: noteId, note: 'spike v1' }] } },
    cursor1,
  );
  assert.ok(createResult.ok, `create push failed: ${JSON.stringify(createResult.body)}`);
  console.log('   OK — pushed', noteId);

  console.log('3. Pull since cursor1 -> expect it in created, not updated...');
  const afterCreate = await pull(disciple1Token, cursor1);
  assert.equal(afterCreate.changes.spike_sync_notes.created.length, 1);
  assert.equal(afterCreate.changes.spike_sync_notes.created[0].id, noteId);
  assert.equal(afterCreate.changes.spike_sync_notes.updated.length, 0);
  console.log('   OK');
  const cursor2 = afterCreate.timestamp;

  console.log('4. Push an update to the same note...');
  const updateResult = await push(
    disciple1Token,
    { spike_sync_notes: { updated: [{ id: noteId, note: 'spike v2' }] } },
    cursor2,
  );
  assert.ok(updateResult.ok, `update push failed: ${JSON.stringify(updateResult.body)}`);

  console.log(
    '5. Pull since cursor2 -> expect it in updated, not created (baseline correctly excluded)...',
  );
  const afterUpdate = await pull(disciple1Token, cursor2);
  assert.equal(afterUpdate.changes.spike_sync_notes.created.length, 0);
  assert.equal(afterUpdate.changes.spike_sync_notes.updated.length, 1);
  assert.equal(afterUpdate.changes.spike_sync_notes.updated[0].note, 'spike v2');
  console.log('   OK');
  const cursor3 = afterUpdate.timestamp;

  console.log('6. Push a delete (tombstone)...');
  const deleteResult = await push(
    disciple1Token,
    { spike_sync_notes: { deleted: [noteId] } },
    cursor3,
  );
  assert.ok(deleteResult.ok, `delete push failed: ${JSON.stringify(deleteResult.body)}`);

  console.log('7. Pull since cursor3 -> expect it as a deleted id...');
  const afterDelete = await pull(disciple1Token, cursor3);
  assert.deepEqual(afterDelete.changes.spike_sync_notes.deleted, [noteId]);
  console.log('   OK');

  console.log("8. RLS: disciple_2 pulling from scratch must not see disciple_1's note...");
  const disciple2Pull = await pull(disciple2Token, null);
  const disciple2Ids = disciple2Pull.changes.spike_sync_notes.created.map((r) => r.id);
  assert.ok(!disciple2Ids.includes(noteId));
  console.log('   OK — sync is RLS-scoped, not just endpoint-scoped');

  console.log("9. RLS: disciple_2 cannot push a change onto disciple_1's note id...");
  // Re-create a fresh note as disciple_1 to attack, since the previous one is now soft-deleted.
  const attackTargetId = randomUUID();
  await push(
    disciple1Token,
    { spike_sync_notes: { created: [{ id: attackTargetId, note: 'attack target' }] } },
    afterDelete.timestamp,
  );

  const attack = await push(
    disciple2Token,
    { spike_sync_notes: { updated: [{ id: attackTargetId, note: 'hijacked by disciple_2' }] } },
    afterDelete.timestamp,
  );
  // The RLS UPDATE policy scopes by owner_id = auth.uid(), so this matches
  // zero rows rather than erroring — the endpoint still returns success,
  // but nothing actually changes. Verify via direct (RLS-bypassing) read.
  const { data: unchanged } = await admin
    .from('spike_sync_notes')
    .select('note')
    .eq('id', attackTargetId)
    .single();
  assert.equal(
    unchanged.note,
    'attack target',
    "disciple_2 must NOT have been able to mutate disciple_1's row",
  );
  console.log(
    '   OK — push endpoint returned',
    attack.status,
    "but RLS silently no-op'd the cross-user write",
  );

  await admin.from('spike_sync_notes').delete().eq('id', attackTargetId);

  console.log('\nAll sync spike protocol + RLS checks passed.');
}

main().catch((err) => {
  console.error('SPIKE TEST FAILED:', err);
  process.exit(1);
});
