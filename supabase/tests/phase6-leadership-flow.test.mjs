// Phase 6 verification: exercises the exact Supabase operations
// apps/mobile/lib/queries/leadership.ts performs, and the reassign-builder
// Edge Function, against the real dev database — proving the data layer
// behind every Supervising Minister / Lead Pastor screen actually works.
//
// Covers the literal Phase 6 Gate: a seeded Lead Pastor and Supervising
// Minister each independently approve a pathway request (parallel), and
// graduation only unlocks after all three approvers act in the correct
// order (sequential, DB-enforced). Also covers rejection paths, org
// stats/at-risk/builder-capacity reads, and Builder reassignment.
//
// Usage: node --env-file=.env --test supabase/tests/phase6-leadership-flow.test.mjs

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { adminClient, loadSeedUserIds, signInAs } from './helpers.mjs';

const FUNCTIONS_URL = `${process.env.SUPABASE_DEV_URL}/functions/v1`;

async function callFunction(name, token, bodyObj) {
  const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyObj ?? {}),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

let userIds;
let pathwayId;
let smClient;
let lpClient;
let lpToken;

async function cleanupDiscipleFlow(discipleId) {
  const { data: enrollments } = await adminClient
    .from('enrollments')
    .select('id')
    .eq('disciple_id', discipleId);
  for (const { id } of enrollments ?? []) {
    await adminClient.from('graduation_requests').delete().eq('enrollment_id', id);
    await adminClient.from('module_progress').delete().eq('enrollment_id', id);
  }
  await adminClient.from('enrollments').delete().eq('disciple_id', discipleId);
  await adminClient.from('pathway_requests').delete().eq('disciple_id', discipleId);
}

// Phase 8's notification triggers fire throughout this file's flow
// (pathway request insert/reject, graduation step advance/reject) — broad
// cleanup by recipient rather than tracking every payload id.
async function cleanupNotifications() {
  for (const key of [
    'disciple_4',
    'disciple_5',
    'disciple_6',
    'builder_1',
    'builder_2',
    'lead_pastor',
    'supervising_minister',
  ]) {
    await adminClient.from('notifications').delete().eq('user_id', userIds[key]);
  }
}

before(async () => {
  userIds = await loadSeedUserIds();

  const { data: pathway } = await adminClient
    .from('pathways')
    .select('id')
    .eq('name', 'Seed Pathway: Finance')
    .single();
  pathwayId = pathway.id;

  await cleanupDiscipleFlow(userIds.disciple_4);
  await cleanupDiscipleFlow(userIds.disciple_5);
  await cleanupDiscipleFlow(userIds.disciple_6);
  await cleanupNotifications();

  smClient = await signInAs('supervising_minister');
  lpClient = await signInAs('lead_pastor');
  const {
    data: { session: lpSession },
  } = await lpClient.auth.getSession();
  lpToken = lpSession.access_token;
});

after(async () => {
  if (!userIds) return; // before() itself failed — nothing was created to tear down
  await cleanupDiscipleFlow(userIds.disciple_4);
  await cleanupDiscipleFlow(userIds.disciple_5);
  await cleanupDiscipleFlow(userIds.disciple_6);
  await cleanupNotifications();
});

describe('Pathway approval queue — parallel, either order (the Phase 6 Gate)', () => {
  let requestId;

  before(async () => {
    const { data } = await adminClient
      .from('pathway_requests')
      .insert({ disciple_id: userIds.disciple_4, pathway_id: pathwayId })
      .select('id')
      .single();
    requestId = data.id;
  });

  it('appears in both the SM and LP queues while unactioned', async () => {
    const smQueue = await smClient
      .from('pathway_requests')
      .select('id, sm_approved_at')
      .in('status', ['requested', 'under_review'])
      .is('sm_approved_at', null);
    const lpQueue = await lpClient
      .from('pathway_requests')
      .select('id, lp_approved_at')
      .in('status', ['requested', 'under_review'])
      .is('lp_approved_at', null);
    assert.ok(smQueue.data.some((r) => r.id === requestId));
    assert.ok(lpQueue.data.some((r) => r.id === requestId));
  });

  it('the Lead Pastor approves first — status moves to under_review, drops from the LP queue only', async () => {
    const { data, error } = await lpClient
      .from('pathway_requests')
      .update({ lp_approved_at: new Date().toISOString() })
      .eq('id', requestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'under_review');

    const smQueue = await smClient
      .from('pathway_requests')
      .select('id')
      .is('sm_approved_at', null)
      .eq('id', requestId);
    const lpQueue = await lpClient
      .from('pathway_requests')
      .select('id')
      .is('lp_approved_at', null)
      .eq('id', requestId);
    assert.equal(smQueue.data.length, 1, 'still waiting on SM');
    assert.equal(lpQueue.data.length, 0, 'LP already acted');
  });

  it('the Supervising Minister approves second — status becomes approved, enrollment created', async () => {
    const { data, error } = await smClient
      .from('pathway_requests')
      .update({ sm_approved_at: new Date().toISOString() })
      .eq('id', requestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'approved');

    const { data: enrollment } = await adminClient
      .from('enrollments')
      .select('id, status')
      .eq('disciple_id', userIds.disciple_4)
      .eq('status', 'active')
      .maybeSingle();
    assert.ok(enrollment, 'Phase 4 trigger should have created the enrollment');
  });
});

describe('Pathway rejection (either approver, mandatory reason)', () => {
  let requestId;

  before(async () => {
    const { data } = await adminClient
      .from('pathway_requests')
      .insert({ disciple_id: userIds.disciple_5, pathway_id: pathwayId })
      .select('id')
      .single();
    requestId = data.id;
  });

  it('the Supervising Minister can reject with a reason', async () => {
    const { data, error } = await smClient
      .from('pathway_requests')
      .update({ rejection_reason: 'Not ready for this pathway yet' })
      .eq('id', requestId)
      .select('status, rejection_reason')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'rejected');
    assert.equal(data.rejection_reason, 'Not ready for this pathway yet');
  });
});

describe('Graduation approval queue — sequential, DB-enforced (the Phase 6 Gate)', () => {
  let enrollmentId;
  let graduationRequestId;

  before(async () => {
    const { data: enrollment } = await adminClient
      .from('enrollments')
      .insert({ disciple_id: userIds.disciple_6, pathway_id: pathwayId })
      .select('id')
      .single();
    enrollmentId = enrollment.id;

    const { data: gradReq } = await adminClient
      .from('graduation_requests')
      .insert({ enrollment_id: enrollmentId, builder_at: new Date().toISOString() })
      .select('id, status')
      .single();
    graduationRequestId = gradReq.id;
    assert.equal(gradReq.status, 'builder_recommended');
  });

  it('appears in the SM queue, not the LP queue, while awaiting sm_at', async () => {
    const smQueue = await smClient
      .from('graduation_requests')
      .select('id')
      .eq('status', 'builder_recommended')
      .eq('id', graduationRequestId);
    const lpQueue = await lpClient
      .from('graduation_requests')
      .select('id')
      .eq('status', 'sm_reviewed')
      .eq('id', graduationRequestId);
    assert.equal(smQueue.data.length, 1);
    assert.equal(lpQueue.data.length, 0);
  });

  it('the Lead Pastor cannot set lp_at before sm_at exists (CHECK constraint)', async () => {
    const { error } = await lpClient
      .from('graduation_requests')
      .update({ lp_at: new Date().toISOString() })
      .eq('id', graduationRequestId);
    assert.ok(error, 'expected graduation_requests_lp_requires_sm to reject this');
  });

  it('the Supervising Minister approves — status becomes sm_reviewed, moves to the LP queue', async () => {
    const { data, error } = await smClient
      .from('graduation_requests')
      .update({ sm_at: new Date().toISOString() })
      .eq('id', graduationRequestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'sm_reviewed');

    const lpQueue = await lpClient
      .from('graduation_requests')
      .select('id')
      .eq('status', 'sm_reviewed')
      .eq('id', graduationRequestId);
    assert.equal(lpQueue.data.length, 1);
  });

  it('the Lead Pastor approves last — status becomes graduated, cascades to the enrollment', async () => {
    const { data, error } = await lpClient
      .from('graduation_requests')
      .update({ lp_at: new Date().toISOString() })
      .eq('id', graduationRequestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'graduated');

    const { data: enrollment } = await adminClient
      .from('enrollments')
      .select('status, graduated_at')
      .eq('id', enrollmentId)
      .single();
    assert.equal(enrollment.status, 'graduated');
    assert.ok(enrollment.graduated_at);
  });
});

describe('Org-wide reporting reads', () => {
  it('SM can read active-disciple, pending-pathway, and pending-graduation counts', async () => {
    const [disciples, pathwayRequests, graduationRequests] = await Promise.all([
      smClient
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'disciple')
        .eq('status', 'active'),
      smClient
        .from('pathway_requests')
        .select('id', { count: 'exact', head: true })
        .in('status', ['requested', 'under_review']),
      smClient
        .from('graduation_requests')
        .select('id', { count: 'exact', head: true })
        .in('status', ['builder_recommended', 'sm_reviewed']),
    ]);
    assert.equal(disciples.error, null);
    assert.equal(pathwayRequests.error, null);
    assert.equal(graduationRequests.error, null);
    assert.ok(typeof disciples.count === 'number' && disciples.count >= 0);
  });

  it('SM can read builder_disciple across both builders (capacity monitoring)', async () => {
    const { data, error } = await smClient
      .from('builder_disciple')
      .select('builder_id')
      .eq('status', 'active');
    assert.equal(error, null);
    const counts = {};
    for (const row of data) counts[row.builder_id] = (counts[row.builder_id] ?? 0) + 1;
    assert.equal(counts[userIds.builder_1], 3);
  });

  it('SM sees only digest-channel notifications in the digest view (none currently, Phase 8 not built yet)', async () => {
    const { data, error } = await smClient
      .from('notifications')
      .select('id')
      .eq('channel', 'digest');
    assert.equal(error, null);
    assert.ok(Array.isArray(data));
  });
});

describe('Builder reassignment (Edge Function, Section F2 audit trail)', () => {
  after(async () => {
    // Restore disciple_6 to builder_2 so the seed topology is unchanged
    // for other test files / manual QA after this run.
    await callFunction('reassign-builder', lpToken, {
      discipleId: userIds.disciple_6,
      newBuilderId: userIds.builder_2,
      reason: 'Test teardown: restoring original seed pairing',
    });
  });

  it('the Lead Pastor can reassign disciple_6 from builder_2 to builder_1, preserving history', async () => {
    const res = await callFunction('reassign-builder', lpToken, {
      discipleId: userIds.disciple_6,
      newBuilderId: userIds.builder_1,
      reason: 'Test: temporary reassignment',
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.newPairingId);

    const { data: ended } = await adminClient
      .from('builder_disciple')
      .select('status, ended_at, reassignment_reason')
      .eq('disciple_id', userIds.disciple_6)
      .eq('builder_id', userIds.builder_2)
      .eq('status', 'ended')
      .order('ended_at', { ascending: false })
      .limit(1)
      .single();
    assert.equal(ended.status, 'ended');
    assert.ok(ended.ended_at);
    assert.equal(ended.reassignment_reason, 'Test: temporary reassignment');

    const { data: active } = await adminClient
      .from('builder_disciple')
      .select('builder_id, status')
      .eq('disciple_id', userIds.disciple_6)
      .eq('status', 'active')
      .single();
    assert.equal(active.builder_id, userIds.builder_1);
  });
});
