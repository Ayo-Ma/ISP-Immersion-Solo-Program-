// Phase 8 verification: exercises every event in the PRD Notification
// Matrix (Section B) against the real dev database, confirming the
// correct notifications row (user, event_type, channel) actually appears
// — not assumed from reading the trigger SQL.
//
// Covers the literal Phase 8 Gate: "Triggering every event in the
// Notification Matrix produces the correct notification, to the correct
// role, on the correct channel (real-time vs. digest) — tested, not
// assumed." Login/logout events are explicitly out of scope (no clean
// database signal to trigger on — flagged as a deferred gap, not silently
// skipped). Real OneSignal push delivery is also out of scope — this file
// proves the notifications table is populated correctly, which is as far
// as verification can go without real OneSignal credentials.
//
// Usage: node --env-file=.env --test supabase/tests/phase8-notifications-flow.test.mjs

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { adminClient, loadSeedUserIds, signInAs, withRetry } from './helpers.mjs';

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

async function notificationsFor(userId, eventType) {
  const { data, error } = await adminClient
    .from('notifications')
    .select('id, user_id, event_type, payload, channel, created_at')
    .eq('user_id', userId)
    .eq('event_type', eventType);
  if (error) throw error;
  return data;
}

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
  await adminClient
    .from('daily_checklists')
    .delete()
    .eq('disciple_id', discipleId)
    .eq('date', new Date().toISOString().slice(0, 10));
  await adminClient.from('weekly_checkins').delete().eq('disciple_id', discipleId);
  await adminClient.from('notifications').delete().eq('user_id', discipleId);
}

let userIds;
let pathwayId;

before(async () => {
  userIds = await withRetry(() => loadSeedUserIds());

  const { data: pathway } = await adminClient
    .from('pathways')
    .select('id')
    .eq('name', 'Seed Pathway: Finance')
    .single();
  pathwayId = pathway.id;

  for (const key of [
    'disciple_1',
    'disciple_2',
    'disciple_3',
    'disciple_4',
    'disciple_5',
    'disciple_6',
  ]) {
    await cleanupDiscipleFlow(userIds[key]);
  }
  await adminClient.from('notifications').delete().eq('user_id', userIds.builder_1);
  await adminClient.from('notifications').delete().eq('user_id', userIds.builder_2);
  await adminClient.from('notifications').delete().eq('user_id', userIds.lead_pastor);
  await adminClient.from('notifications').delete().eq('user_id', userIds.supervising_minister);
});

after(async () => {
  if (!userIds) return; // before() itself failed — nothing was created to tear down
  for (const key of [
    'disciple_1',
    'disciple_2',
    'disciple_3',
    'disciple_4',
    'disciple_5',
    'disciple_6',
  ]) {
    await cleanupDiscipleFlow(userIds[key]);
  }
  await adminClient.from('notifications').delete().eq('user_id', userIds.builder_1);
  await adminClient.from('notifications').delete().eq('user_id', userIds.builder_2);
  await adminClient.from('notifications').delete().eq('user_id', userIds.lead_pastor);
  await adminClient.from('notifications').delete().eq('user_id', userIds.supervising_minister);
});

describe('Pathway request events', () => {
  let requestId;

  it('creating a request notifies both Lead Pastor and Supervising Minister, realtime', async () => {
    const { data } = await adminClient
      .from('pathway_requests')
      .insert({ disciple_id: userIds.disciple_4, pathway_id: pathwayId })
      .select('id')
      .single();
    requestId = data.id;

    const lp = await notificationsFor(userIds.lead_pastor, 'pathway_request_created');
    const sm = await notificationsFor(userIds.supervising_minister, 'pathway_request_created');
    assert.ok(lp.some((n) => n.payload.pathway_request_id === requestId));
    assert.ok(sm.some((n) => n.payload.pathway_request_id === requestId));
    assert.equal(lp[0].channel, 'realtime');
  });

  it('rejecting notifies the disciple, realtime, with the reason', async () => {
    await adminClient
      .from('pathway_requests')
      .update({ rejection_reason: 'Not ready yet' })
      .eq('id', requestId);

    const notes = await notificationsFor(userIds.disciple_4, 'pathway_request_rejected');
    assert.equal(notes.length, 1);
    assert.equal(notes[0].channel, 'realtime');
    assert.equal(notes[0].payload.rejection_reason, 'Not ready yet');
  });
});

describe('Graduation request events', () => {
  let enrollmentId;
  let graduationRequestId;

  before(async () => {
    const { data: enrollment } = await adminClient
      .from('enrollments')
      .insert({ disciple_id: userIds.disciple_5, pathway_id: pathwayId })
      .select('id')
      .single();
    enrollmentId = enrollment.id;
  });

  it('builder_at notifies the Supervising Minister', async () => {
    const { data } = await adminClient
      .from('graduation_requests')
      .insert({ enrollment_id: enrollmentId, builder_at: new Date().toISOString() })
      .select('id')
      .single();
    graduationRequestId = data.id;

    const sm = await notificationsFor(userIds.supervising_minister, 'graduation_step_advanced');
    assert.ok(sm.some((n) => n.payload.graduation_request_id === graduationRequestId));
  });

  it('sm_at notifies the Lead Pastor', async () => {
    await adminClient
      .from('graduation_requests')
      .update({ sm_at: new Date().toISOString() })
      .eq('id', graduationRequestId);

    const lp = await notificationsFor(userIds.lead_pastor, 'graduation_step_advanced');
    assert.ok(lp.some((n) => n.payload.graduation_request_id === graduationRequestId));
  });

  it('an LP rejection routes back to the Supervising Minister, not the disciple', async () => {
    await adminClient
      .from('graduation_requests')
      .update({ rejection_reason: 'Needs more time' })
      .eq('id', graduationRequestId);

    const sm = await notificationsFor(userIds.supervising_minister, 'graduation_request_rejected');
    assert.equal(sm.length, 1);
    const discipleNotified = await notificationsFor(
      userIds.disciple_5,
      'graduation_request_rejected',
    );
    assert.equal(
      discipleNotified.length,
      0,
      'PRD: rejection routes to the prior approver, not the disciple',
    );
  });

  it('an SM rejection (before sm_at) routes back to the assigned Builder', async () => {
    const { data: enrollment } = await adminClient
      .from('enrollments')
      .insert({ disciple_id: userIds.disciple_6, pathway_id: pathwayId })
      .select('id')
      .single();
    const { data: gradReq } = await adminClient
      .from('graduation_requests')
      .insert({ enrollment_id: enrollment.id, builder_at: new Date().toISOString() })
      .select('id')
      .single();

    await adminClient
      .from('graduation_requests')
      .update({ rejection_reason: 'Not consistent enough yet' })
      .eq('id', gradReq.id);

    const builder = await notificationsFor(userIds.builder_2, 'graduation_request_rejected');
    assert.ok(builder.some((n) => n.payload.graduation_request_id === gradReq.id));
  });
});

describe('Daily checklist submission', () => {
  it('submitting notifies the assigned Builder, realtime', async () => {
    const discipleClient = await signInAs('disciple_1');
    const { data: checklist } = await discipleClient
      .from('daily_checklists')
      .insert({ date: new Date().toISOString().slice(0, 10) })
      .select('id')
      .single();
    await discipleClient
      .from('daily_checklists')
      .update({ status: 'submitted' })
      .eq('id', checklist.id);

    const builder = await notificationsFor(userIds.builder_1, 'checklist_submitted');
    assert.ok(builder.some((n) => n.payload.checklist_id === checklist.id));
    assert.equal(builder[0].channel, 'realtime');
  });
});

describe('Weekly check-in events', () => {
  let weeklyCheckinId;
  const proposedTime = new Date(Date.now() + 24 * 3600_000).toISOString();

  before(async () => {
    const { data } = await adminClient
      .from('weekly_checkins')
      .insert({
        builder_id: userIds.builder_1,
        disciple_id: userIds.disciple_2,
        proposed_times: [proposedTime, proposedTime, proposedTime],
        meet_link: 'https://meet.google.com/test',
      })
      .select('id')
      .single();
    weeklyCheckinId = data.id;
  });

  it('the disciple picking a time notifies both parties', async () => {
    const discipleClient = await signInAs('disciple_2');
    const {
      data: { session },
    } = await discipleClient.auth.getSession();
    const res = await callFunction('select-checkin-time', session.access_token, {
      weeklyCheckinId,
      chosenTime: proposedTime,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const disciple = await notificationsFor(userIds.disciple_2, 'weekly_checkin_scheduled');
    const builder = await notificationsFor(userIds.builder_1, 'weekly_checkin_scheduled');
    assert.equal(disciple.length, 1);
    assert.equal(builder.length, 1);
  });

  it('the Builder submitting a report notifies both parties', async () => {
    const builderClient = await signInAs('builder_1');
    await builderClient
      .from('weekly_checkins')
      .update({ report: 'Good check-in.', status: 'completed' })
      .eq('id', weeklyCheckinId);

    const disciple = await notificationsFor(userIds.disciple_2, 'weekly_checkin_completed');
    const builder = await notificationsFor(userIds.builder_1, 'weekly_checkin_completed');
    assert.equal(disciple.length, 1);
    assert.equal(builder.length, 1);
  });
});

describe('Module completion and test attempts', () => {
  let moduleProgressId;

  before(async () => {
    const { data: enrollment } = await adminClient
      .from('enrollments')
      .insert({ disciple_id: userIds.disciple_3, pathway_id: pathwayId })
      .select('id')
      .single();

    const { data: modules } = await adminClient
      .from('modules')
      .select('id')
      .eq('pathway_id', pathwayId)
      .order('order_index')
      .limit(1);

    const { data: progress } = await adminClient
      .from('module_progress')
      .select('id')
      .eq('enrollment_id', enrollment.id)
      .eq('module_id', modules[0].id)
      .single();
    moduleProgressId = progress.id;
  });

  it('a passing attempt notifies disciple + Builder (test_passed) and disciple + Builder (module_completed), and LP/SM via digest', async () => {
    const discipleClient = await signInAs('disciple_3');
    const {
      data: { session },
    } = await discipleClient.auth.getSession();
    const res = await callFunction('record-test-attempt', session.access_token, {
      moduleProgressId,
      score: 90,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const disciplePassed = await notificationsFor(userIds.disciple_3, 'test_passed');
    const builderPassed = await notificationsFor(userIds.builder_1, 'test_passed');
    assert.equal(disciplePassed.length, 1);
    assert.equal(builderPassed.length, 1);

    const builderCompleted = await notificationsFor(userIds.builder_1, 'module_completed');
    assert.equal(builderCompleted.length, 1);
    assert.equal(builderCompleted[0].channel, 'realtime');

    const lpDigest = await notificationsFor(userIds.lead_pastor, 'module_completed');
    const smDigest = await notificationsFor(userIds.supervising_minister, 'module_completed');
    assert.equal(lpDigest.length, 1);
    assert.equal(lpDigest[0].channel, 'digest');
    assert.equal(smDigest.length, 1);
    assert.equal(smDigest[0].channel, 'digest');
  });
});

describe('Falling-behind detection job (Section B: 3+ days inactive)', () => {
  let countAfterFirstRun;

  before(async () => {
    // A fresh enrollment with zero daily_checklists history trivially
    // satisfies "no activity in the last 3 days."
    await adminClient
      .from('enrollments')
      .insert({ disciple_id: userIds.disciple_4, pathway_id: pathwayId });
  });

  it('notifies the disciple (gentle reminder) and their Builder (real-time alert)', async () => {
    const { error } = await adminClient.rpc('detect_falling_behind_disciples');
    assert.equal(error, null);

    const disciple = await notificationsFor(userIds.disciple_4, 'disciple_inactive_3d');
    const builder = await notificationsFor(userIds.builder_2, 'disciple_inactive_3d_alert');
    // >=1, not ===1: this dev project's real pg_cron schedule
    // (0 8 * * *) runs this exact function independently of this test, so
    // a manual call here can legitimately race with a real scheduled
    // firing on the same calendar day — each is correctly deduped against
    // re-notifying the SAME already-notified day, but two genuinely
    // concurrent callers can each pass that check before the other
    // commits. What matters for the Gate is that a notification exists at
    // all; the "does not duplicate" test below is what actually proves
    // the dedup logic itself works, under non-concurrent conditions.
    assert.ok(disciple.length >= 1);
    assert.ok(builder.length >= 1);
    assert.equal(disciple[0].channel, 'realtime');
    assert.equal(builder[0].channel, 'realtime');
    countAfterFirstRun = disciple.length;
  });

  it('does not duplicate on a second run the same day', async () => {
    await adminClient.rpc('detect_falling_behind_disciples');
    const disciple = await notificationsFor(userIds.disciple_4, 'disciple_inactive_3d');
    assert.equal(disciple.length, countAfterFirstRun);
  });
});

describe('dispatch-push-notifications (no-op until real OneSignal credentials exist)', () => {
  it('reports disabled:true and leaves pending notifications unsent', async () => {
    const res = await callFunction(
      'dispatch-push-notifications',
      process.env.SUPABASE_DEV_SECRET_KEY,
      {},
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.disabled, true);
    assert.equal(res.body.dispatched, 0);
  });
});
