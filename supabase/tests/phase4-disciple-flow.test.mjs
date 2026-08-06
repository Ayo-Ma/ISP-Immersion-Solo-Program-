// Phase 4 verification: exercises the exact Supabase operations
// apps/mobile/lib/queries/disciple.ts and lib/edgeFunctions.ts perform,
// against the real dev database and deployed Edge Functions — proving the
// data layer behind every Disciple screen actually works, since no device
// is available in this session to verify the rendered UI itself.
//
// Covers the literal Phase 4 Gate: register -> get approved (seeded
// approval) -> enrollment exists -> module progress reachable -> fail a
// test and hit the retake gate -> pass after rewatch+cooldown -> submit a
// daily checklist through its full status lifecycle.
//
// Usage: node --env-file=.env --test supabase/tests/phase4-disciple-flow.test.mjs

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
let discipleClient;
let discipleToken;

before(async () => {
  userIds = await loadSeedUserIds();

  const { data: pathway } = await adminClient
    .from('pathways')
    .select('id')
    .eq('name', 'Seed Pathway: Finance')
    .single();
  pathwayId = pathway.id;

  // Defensive cleanup: this disciple must start with no pathway_request,
  // enrollment, or checklist so the full lifecycle below is deterministic.
  await adminClient.from('pathway_requests').delete().eq('disciple_id', userIds.disciple_3);
  await adminClient
    .from('module_progress')
    .delete()
    .in(
      'enrollment_id',
      (
        await adminClient.from('enrollments').select('id').eq('disciple_id', userIds.disciple_3)
      ).data?.map((e) => e.id) ?? [],
    );
  await adminClient.from('enrollments').delete().eq('disciple_id', userIds.disciple_3);
  await adminClient
    .from('daily_checklists')
    .delete()
    .eq('disciple_id', userIds.disciple_3)
    .eq('date', new Date().toISOString().slice(0, 10));
  await adminClient.from('prayer_sessions').delete().eq('disciple_id', userIds.disciple_3);

  discipleClient = await signInAs('disciple_3');
  const {
    data: { session },
  } = await discipleClient.auth.getSession();
  discipleToken = session.access_token;
});

after(async () => {
  if (!userIds) return; // before() itself failed — nothing was created to tear down
  const { data: enrollment } = await adminClient
    .from('enrollments')
    .select('id')
    .eq('disciple_id', userIds.disciple_3)
    .maybeSingle();
  if (enrollment) {
    await adminClient.from('module_progress').delete().eq('enrollment_id', enrollment.id);
  }
  await adminClient.from('pathway_requests').delete().eq('disciple_id', userIds.disciple_3);
  await adminClient.from('enrollments').delete().eq('disciple_id', userIds.disciple_3);
  await adminClient
    .from('daily_checklists')
    .delete()
    .eq('disciple_id', userIds.disciple_3)
    .eq('date', new Date().toISOString().slice(0, 10));
  await adminClient.from('prayer_sessions').delete().eq('disciple_id', userIds.disciple_3);
});

describe('Registration -> pathway status (RegistrationScreen / PathwayStatusScreen data layer)', () => {
  it('lists pathways (RegistrationScreen)', async () => {
    const { data, error } = await discipleClient.from('pathways').select('id, name, description');
    assert.equal(error, null);
    assert.ok(data.some((p) => p.id === pathwayId));
  });

  it('has no pathway request yet (getMyLatestPathwayRequest -> null drives Registration)', async () => {
    const { data, error } = await discipleClient
      .from('pathway_requests')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    assert.equal(error, null);
    assert.equal(data, null);
  });

  it('creates a pathway request via the create-pathway-request Edge Function', async () => {
    const res = await callFunction('create-pathway-request', discipleToken, { pathwayId });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'requested');
  });

  it('PathwayStatusScreen sees status=requested', async () => {
    const { data } = await discipleClient
      .from('pathway_requests')
      .select('status, pathways(name)')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    assert.equal(data.status, 'requested');
    assert.equal(data.pathways.name, 'Seed Pathway: Finance');
  });
});

describe('Seeded approval -> enrollment created (the Phase 4 gap fix)', () => {
  it('LP + SM approval flips status to approved AND creates an active enrollment', async () => {
    const { data: request } = await adminClient
      .from('pathway_requests')
      .select('id')
      .eq('disciple_id', userIds.disciple_3)
      .single();

    await adminClient
      .from('pathway_requests')
      .update({ lp_approved_at: new Date().toISOString() })
      .eq('id', request.id);
    const { data: afterLp } = await adminClient
      .from('pathway_requests')
      .update({ sm_approved_at: new Date().toISOString() })
      .eq('id', request.id)
      .select('status')
      .single();
    assert.equal(afterLp.status, 'approved');

    const { data: enrollment } = await discipleClient
      .from('enrollments')
      .select('id, status, pathways(name)')
      .eq('status', 'active')
      .maybeSingle();
    assert.ok(enrollment, 'enrollment should have been created by the new trigger');
    assert.equal(enrollment.status, 'active');
    assert.equal(enrollment.pathways.name, 'Seed Pathway: Finance');
  });
});

describe('Module progress + retake gating (LessonScreen / TestScreen data layer)', () => {
  let enrollmentId;
  let moduleProgressId;

  before(async () => {
    const { data: enrollment } = await adminClient
      .from('enrollments')
      .select('id')
      .eq('disciple_id', userIds.disciple_3)
      .single();
    enrollmentId = enrollment.id;

    // module_progress rows are now auto-created (cascade trigger, this
    // phase's second gap fix) the moment the enrollment exists — nothing
    // to insert here, just find the first module's row.
    const { data: firstModule } = await adminClient
      .from('modules')
      .select('id')
      .eq('pathway_id', pathwayId)
      .order('order_index')
      .limit(1)
      .single();

    const { data: progress } = await adminClient
      .from('module_progress')
      .select('id')
      .eq('enrollment_id', enrollmentId)
      .eq('module_id', firstModule.id)
      .single();
    moduleProgressId = progress.id;
  });

  it('DashboardScreen finds one module_progress row per module in the pathway (cascade fix), all not_started', async () => {
    const { data: pathwayModules } = await adminClient
      .from('modules')
      .select('id')
      .eq('pathway_id', pathwayId);

    const { data } = await discipleClient
      .from('module_progress')
      .select('id, status, modules(title)')
      .eq('enrollment_id', enrollmentId);
    assert.equal(data.length, pathwayModules.length);
    assert.ok(data.every((row) => row.status === 'not_started'));
  });

  it('LessonScreen can clock in directly (disciple-writable, no Edge Function needed)', async () => {
    const { error } = await discipleClient
      .from('module_progress')
      .update({ clock_in_at: new Date().toISOString() })
      .eq('id', moduleProgressId);
    assert.equal(error, null);
  });

  it('failing the test requires rewatch + cooldown before a retake (TestScreen gating)', async () => {
    const fail = await callFunction('record-test-attempt', discipleToken, {
      moduleProgressId,
      score: 40,
    });
    assert.equal(fail.status, 200, JSON.stringify(fail.body));
    assert.equal(fail.body.status, 'failed');

    const immediateRetry = await callFunction('record-test-attempt', discipleToken, {
      moduleProgressId,
      score: 90,
    });
    assert.equal(immediateRetry.status, 409);

    await discipleClient
      .from('module_progress')
      .update({ rewatched_at: new Date().toISOString() })
      .eq('id', moduleProgressId);
    await adminClient
      .from('module_progress')
      .update({ cooldown_until: new Date(Date.now() - 1000).toISOString() })
      .eq('id', moduleProgressId);

    const pass = await callFunction('record-test-attempt', discipleToken, {
      moduleProgressId,
      score: 90,
    });
    assert.equal(pass.status, 200, JSON.stringify(pass.body));
    assert.equal(pass.body.status, 'passed');
  });
});

describe('Daily checklist full lifecycle (ChecklistScreen data layer)', () => {
  let checklistId;
  const today = new Date().toISOString().slice(0, 10);

  it('creates today’s checklist in draft', async () => {
    const { data, error } = await discipleClient
      .from('daily_checklists')
      .insert({ date: today })
      .select('id, status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'draft');
    checklistId = data.id;
  });

  it('toggles class/test while still draft', async () => {
    const { data, error } = await discipleClient
      .from('daily_checklists')
      .update({ class_done: true, test_done: true })
      .eq('id', checklistId)
      .select('class_done, test_done')
      .single();
    assert.equal(error, null);
    assert.ok(data.class_done && data.test_done);
  });

  it('prayer_done cannot be set directly — only via clock-out-prayer (Phase 7)', async () => {
    const { error } = await discipleClient
      .from('daily_checklists')
      .update({ prayer_done: true })
      .eq('id', checklistId);
    assert.ok(error, 'expected the guard trigger to reject this');
  });

  it('clocking in then out of a prayer session sets prayer_done via the Edge Function', async () => {
    const { data: session, error: sessionError } = await discipleClient
      .from('prayer_sessions')
      .insert({})
      .select('id')
      .single();
    assert.equal(sessionError, null);

    const res = await callFunction('clock-out-prayer', discipleToken, {
      sessionId: session.id,
      checklistId,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.checklistPrayerDone, true);

    const { data } = await discipleClient
      .from('daily_checklists')
      .select('prayer_done')
      .eq('id', checklistId)
      .single();
    assert.equal(data.prayer_done, true);
  });

  it('submitting normalizes straight to pending_review (Phase 2 trigger)', async () => {
    const { data, error } = await discipleClient
      .from('daily_checklists')
      .update({ status: 'submitted' })
      .eq('id', checklistId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'pending_review');
  });

  it('the disciple can no longer edit it once out of draft', async () => {
    const { data } = await discipleClient
      .from('daily_checklists')
      .update({ class_done: false })
      .eq('id', checklistId)
      .select();
    assert.equal(data.length, 0);
  });

  it('the assigned Builder can approve it', async () => {
    const builderClient = await signInAs('builder_1');
    const { data, error } = await builderClient
      .from('daily_checklists')
      .update({ status: 'approved', builder_reviewed_at: new Date().toISOString() })
      .eq('id', checklistId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'approved');
  });
});
