// Phase 2 Edge Function tests (MVP Dev Roadmap Gate: "Every state machine
// has passing unit tests for both valid and invalid transitions"). Calls
// the three real deployed functions over HTTP, exactly as the app would —
// not importing their handlers directly, since the point is to prove the
// deployed artifact behaves correctly, not just the source.
//
// Usage: node --env-file=.env --test supabase/tests/edge-functions.test.mjs

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { adminClient, loadSeedUserIds, signInAs } from './helpers.mjs';

const FUNCTIONS_URL = `${process.env.SUPABASE_DEV_URL}/functions/v1`;

async function callFunction(name, token, bodyObj) {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyObj ?? {}),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body };
}

let userIds;
let pathwayId;
let clients = {}; // access tokens, for calling Edge Functions
let supaClients = {}; // full signed-in clients, for RLS-scoped direct table access

before(async () => {
  userIds = await loadSeedUserIds();

  const { data: pathway, error } = await adminClient
    .from('pathways')
    .select('id')
    .eq('name', 'Seed Pathway: Finance')
    .single();
  if (error) throw error;
  pathwayId = pathway.id;

  for (const key of [
    'disciple_6',
    'builder_1',
    'builder_2',
    'supervising_minister',
    'lead_pastor',
  ]) {
    const client = await signInAs(key);
    supaClients[key] = client;
    const {
      data: { session },
    } = await client.auth.getSession();
    clients[key] = session.access_token;
  }
});

describe('create-pathway-request', () => {
  after(async () => {
    await adminClient.from('pathway_requests').delete().eq('disciple_id', userIds.disciple_6);
  });

  it('INVALID: no Authorization header -> 401', async () => {
    const res = await callFunction('create-pathway-request', null, { pathwayId });
    assert.equal(res.status, 401);
  });

  it('INVALID: missing pathwayId -> 400 (Zod)', async () => {
    const res = await callFunction('create-pathway-request', clients.disciple_6, {});
    assert.equal(res.status, 400);
  });

  it('INVALID: unknown pathwayId -> 404', async () => {
    const res = await callFunction('create-pathway-request', clients.disciple_6, {
      pathwayId: '00000000-0000-0000-0000-000000000000',
    });
    assert.equal(res.status, 404);
  });

  it('INVALID: a Builder cannot submit a pathway request -> 403', async () => {
    const res = await callFunction('create-pathway-request', clients.builder_1, { pathwayId });
    assert.equal(res.status, 403);
  });

  it('VALID: a disciple with no pending request succeeds', async () => {
    const res = await callFunction('create-pathway-request', clients.disciple_6, { pathwayId });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'requested');
    assert.ok(res.body.pathwayRequestId);
  });

  it('INVALID: a second request while one is pending -> 409', async () => {
    const res = await callFunction('create-pathway-request', clients.disciple_6, { pathwayId });
    assert.equal(res.status, 409);
  });
});

describe('reassign-builder', () => {
  let originalPairingId;

  before(async () => {
    const { data } = await adminClient
      .from('builder_disciple')
      .select('id')
      .eq('disciple_id', userIds.disciple_6)
      .eq('status', 'active')
      .single();
    originalPairingId = data.id;
  });

  after(async () => {
    // Restore the original builder_2 <-> disciple_6 seed pairing so other
    // runs (and the seed script's own idempotency assumptions) stay valid.
    const { data: current } = await adminClient
      .from('builder_disciple')
      .select('id, builder_id')
      .eq('disciple_id', userIds.disciple_6)
      .eq('status', 'active')
      .single();
    if (current && current.builder_id !== userIds.builder_2) {
      await adminClient
        .from('builder_disciple')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          reassignment_reason: 'Test cleanup: restoring original seed pairing',
        })
        .eq('id', current.id);
      await adminClient.from('builder_disciple').insert({
        builder_id: userIds.builder_2,
        disciple_id: userIds.disciple_6,
        assigned_by: userIds.lead_pastor,
        status: 'active',
      });
    }
  });

  it('INVALID: a disciple cannot reassign a builder -> 403', async () => {
    const res = await callFunction('reassign-builder', clients.disciple_6, {
      discipleId: userIds.disciple_6,
      newBuilderId: userIds.builder_1,
      reason: 'Attempted self-service reassignment',
    });
    assert.equal(res.status, 403);
  });

  it('INVALID: missing reason -> 400 (Zod)', async () => {
    const res = await callFunction('reassign-builder', clients.supervising_minister, {
      discipleId: userIds.disciple_6,
      newBuilderId: userIds.builder_1,
    });
    assert.equal(res.status, 400);
  });

  it('INVALID: newBuilderId that is actually a disciple -> 404', async () => {
    const res = await callFunction('reassign-builder', clients.supervising_minister, {
      discipleId: userIds.disciple_6,
      newBuilderId: userIds.disciple_1,
      reason: 'Bad target',
    });
    assert.equal(res.status, 404);
  });

  it('VALID: Supervising Minister reassigns disciple_6 from builder_2 to builder_1', async () => {
    const res = await callFunction('reassign-builder', clients.supervising_minister, {
      discipleId: userIds.disciple_6,
      newBuilderId: userIds.builder_1,
      reason: 'Test: builder_2 unavailable',
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.newPairingId);
    assert.equal(res.body.newBuilderActiveDiscipleCount, 4);
    assert.equal(res.body.builderExceedsCapacitySoftCap, false);

    const { data: oldPairing } = await adminClient
      .from('builder_disciple')
      .select('status, reassignment_reason')
      .eq('id', originalPairingId)
      .single();
    assert.equal(oldPairing.status, 'ended');
    assert.equal(oldPairing.reassignment_reason, 'Test: builder_2 unavailable');
  });

  it('INVALID: reassigning to the same (now current) builder again -> 409', async () => {
    const res = await callFunction('reassign-builder', clients.lead_pastor, {
      discipleId: userIds.disciple_6,
      newBuilderId: userIds.builder_1,
      reason: 'Duplicate attempt',
    });
    assert.equal(res.status, 409);
  });
});

describe('record-test-attempt', () => {
  let enrollmentId;
  let moduleProgressId;
  let moduleId;

  before(async () => {
    const { data: enrollment } = await adminClient
      .from('enrollments')
      .insert({ disciple_id: userIds.disciple_6, pathway_id: pathwayId })
      .select('id')
      .single();
    enrollmentId = enrollment.id;

    const { data: modules } = await adminClient
      .from('modules')
      .select('id')
      .eq('pathway_id', pathwayId)
      .order('order_index')
      .limit(1);
    moduleId = modules[0].id;

    // The enrollment→module_progress cascade trigger (Phase 4) already
    // inserted one row per pathway module for this enrollment — fetch the
    // one for moduleId rather than inserting a duplicate.
    const { data: progress, error: progressError } = await adminClient
      .from('module_progress')
      .select('id')
      .eq('enrollment_id', enrollmentId)
      .eq('module_id', moduleId)
      .single();
    if (progressError) throw progressError;
    moduleProgressId = progress.id;
  });

  after(async () => {
    // Delete all cascade-created rows for this enrollment, not just
    // moduleProgressId, or leftover rows block the enrollment delete below
    // (module_progress.enrollment_id is ON DELETE RESTRICT).
    await adminClient.from('module_progress').delete().eq('enrollment_id', enrollmentId);
    await adminClient.from('enrollments').delete().eq('id', enrollmentId);
    await adminClient
      .from('notifications')
      .delete()
      .eq('event_type', 'test_three_failures')
      .contains('payload', { module_progress_id: moduleProgressId });
  });

  it('INVALID: a different disciple cannot submit an attempt for this module -> 403', async () => {
    const other = await signInAs('disciple_1');
    const {
      data: { session },
    } = await other.auth.getSession();
    const res = await callFunction('record-test-attempt', session.access_token, {
      moduleProgressId,
      score: 90,
    });
    assert.equal(res.status, 403);
  });

  it('INVALID: score above 100 -> 400 (Zod)', async () => {
    const res = await callFunction('record-test-attempt', clients.disciple_6, {
      moduleProgressId,
      score: 150,
    });
    assert.equal(res.status, 400);
  });

  it('VALID: first attempt, failing score -> failed, rewatch required, cooldown set', async () => {
    const res = await callFunction('record-test-attempt', clients.disciple_6, {
      moduleProgressId,
      score: 40,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'failed');
    assert.equal(res.body.attempts, 1);
    assert.equal(res.body.rewatchRequired, true);
    assert.ok(res.body.cooldownUntil);
  });

  it('INVALID: retake immediately, without rewatch -> 409', async () => {
    const res = await callFunction('record-test-attempt', clients.disciple_6, {
      moduleProgressId,
      score: 90,
    });
    assert.equal(res.status, 409);
  });

  it('INVALID: retake after an OLD rewatch (before the failure) still does not count -> 409', async () => {
    // Simulate a rewatch timestamp that predates the failure (e.g. they'd
    // watched it once long before ever failing) — must not satisfy the gate.
    await adminClient
      .from('module_progress')
      .update({ rewatched_at: new Date(Date.now() - 60 * 60_000).toISOString() })
      .eq('id', moduleProgressId);

    const res = await callFunction('record-test-attempt', clients.disciple_6, {
      moduleProgressId,
      score: 90,
    });
    assert.equal(res.status, 409);
  });

  it('INVALID: rewatch confirmed, but cooldown still active -> 409', async () => {
    // Through the disciple's own RLS-scoped client, not adminClient — this
    // is the real path a device would use, and exercises the trigger that
    // stamps rewatched_at with the SERVER's clock rather than trusting
    // whatever timestamp the client sends (a device clock could be
    // skewed from Postgres's; see migration 20260802185900).
    const { error } = await supaClients.disciple_6
      .from('module_progress')
      .update({ rewatched_at: new Date().toISOString() })
      .eq('id', moduleProgressId);
    assert.equal(error, null);

    const res = await callFunction('record-test-attempt', clients.disciple_6, {
      moduleProgressId,
      score: 90,
    });
    assert.equal(res.status, 409);
  });

  it('VALID: after rewatch AND cooldown elapsed, retake succeeds', async () => {
    await adminClient
      .from('module_progress')
      .update({ cooldown_until: new Date(Date.now() - 1000).toISOString() })
      .eq('id', moduleProgressId);

    const res = await callFunction('record-test-attempt', clients.disciple_6, {
      moduleProgressId,
      score: 40,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'failed');
    assert.equal(res.body.attempts, 2);
  });

  it('VALID: third consecutive failure alerts the assigned Builder', async () => {
    await supaClients.disciple_6
      .from('module_progress')
      .update({ rewatched_at: new Date().toISOString() })
      .eq('id', moduleProgressId);
    await adminClient
      .from('module_progress')
      .update({ cooldown_until: new Date(Date.now() - 1000).toISOString() })
      .eq('id', moduleProgressId);

    const res = await callFunction('record-test-attempt', clients.disciple_6, {
      moduleProgressId,
      score: 40,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.attempts, 3);
    assert.equal(res.body.builderAlerted, true);

    const { data: currentPairing } = await adminClient
      .from('builder_disciple')
      .select('builder_id')
      .eq('disciple_id', userIds.disciple_6)
      .eq('status', 'active')
      .single();

    const { data: notifications } = await adminClient
      .from('notifications')
      .select('user_id, event_type')
      .eq('event_type', 'test_three_failures');
    assert.ok(
      notifications.some((n) => n.user_id === currentPairing.builder_id),
      'whichever Builder is currently assigned to disciple_6 should be alerted',
    );
  });

  it('VALID: passing score after cooldown clears -> passed', async () => {
    await supaClients.disciple_6
      .from('module_progress')
      .update({ rewatched_at: new Date().toISOString() })
      .eq('id', moduleProgressId);
    await adminClient
      .from('module_progress')
      .update({ cooldown_until: new Date(Date.now() - 1000).toISOString() })
      .eq('id', moduleProgressId);

    const res = await callFunction('record-test-attempt', clients.disciple_6, {
      moduleProgressId,
      score: 75,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'passed');
    assert.equal(res.body.attempts, 4);
  });
});
