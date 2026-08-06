// Phase 5 verification: exercises the exact Supabase operations
// apps/mobile/lib/queries/builder.ts and the two new Edge Functions
// (review-checklist, select-checkin-time) perform, against the real dev
// database — proving the data layer behind every Builder screen actually
// works, since no device is available in this session to verify the
// rendered UI itself.
//
// Covers the literal Phase 5 Gate: a seeded Builder reviews a real
// submitted checklist (approve AND reject-with-reason), and the correct
// downstream state change (status) and notification fire. Also covers the
// rest of the phase's roadmap items: graduation recommendation, and the
// weekly check-in "propose 3 times, disciple picks one" flow end to end.
//
// Usage: node --env-file=.env --test supabase/tests/phase5-builder-flow.test.mjs

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

const TODAY = new Date().toISOString().slice(0, 10);

let userIds;
let pathwayId;
let builderClient;
let builderToken;
let discipleClient;
let discipleToken;

async function cleanupDisciple2() {
  const { data: enrollments } = await adminClient
    .from('enrollments')
    .select('id')
    .eq('disciple_id', userIds.disciple_2);
  for (const { id } of enrollments ?? []) {
    await adminClient.from('graduation_requests').delete().eq('enrollment_id', id);
    await adminClient.from('module_progress').delete().eq('enrollment_id', id);
  }
  await adminClient.from('enrollments').delete().eq('disciple_id', userIds.disciple_2);
  await adminClient.from('pathway_requests').delete().eq('disciple_id', userIds.disciple_2);
  await adminClient
    .from('daily_checklists')
    .delete()
    .eq('disciple_id', userIds.disciple_2)
    .eq('date', TODAY);
  await adminClient.from('weekly_checkins').delete().eq('disciple_id', userIds.disciple_2);
  // Phase 8's notification triggers fire throughout this file's flow
  // (checklist submit/review, graduation recommend, weekly check-in) —
  // broad cleanup by recipient rather than tracking every payload id.
  for (const key of [
    'disciple_1',
    'disciple_2',
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

  // disciple_2 is paired with builder_1 (confirmed by rls.test.mjs's
  // "builder sees own row plus assigned disciples" assertion). Defensive
  // cleanup first, in case a previous crashed run left this disciple mid-flow.
  await cleanupDisciple2();

  builderClient = await signInAs('builder_1');
  const {
    data: { session: builderSession },
  } = await builderClient.auth.getSession();
  builderToken = builderSession.access_token;

  discipleClient = await signInAs('disciple_2');
  const {
    data: { session: discipleSession },
  } = await discipleClient.auth.getSession();
  discipleToken = discipleSession.access_token;
});

after(async () => {
  if (!userIds) return; // before() itself failed — nothing was created to tear down
  await cleanupDisciple2();
});

describe('Builder dashboard data layer (assigned disciples, at-a-glance status)', () => {
  it('the Builder sees disciple_2 among their assigned disciples', async () => {
    const { data, error } = await builderClient
      .from('builder_disciple')
      .select('disciple_id, status')
      .eq('status', 'active');
    assert.equal(error, null);
    assert.ok(data.some((row) => row.disciple_id === userIds.disciple_2));
  });

  it("the assigned disciple's name is readable via users (RLS: Builder + assigned disciples)", async () => {
    const { data, error } = await builderClient
      .from('users')
      .select('id, name')
      .eq('id', userIds.disciple_2)
      .single();
    assert.equal(error, null);
    assert.equal(data.id, userIds.disciple_2);
  });
});

describe('Checklist review (the Phase 5 Gate)', () => {
  let approveChecklistId;
  let rejectChecklistId;

  before(async () => {
    const submit = async () => {
      const { data: created } = await discipleClient
        .from('daily_checklists')
        .insert({ date: TODAY })
        .select('id')
        .single();
      await discipleClient
        .from('daily_checklists')
        .update({ status: 'submitted' })
        .eq('id', created.id);
      return created.id;
    };
    approveChecklistId = await submit();

    // A second checklist row for the same disciple/date would collide with
    // whatever unique constraint daily_checklists(disciple_id, date) has —
    // use a distinct disciple for the reject case instead, still paired
    // with builder_1 (disciple_1, per the same rls.test.mjs assertion).
    await adminClient
      .from('daily_checklists')
      .delete()
      .eq('disciple_id', userIds.disciple_1)
      .eq('date', TODAY);
    const disciple1Client = await signInAs('disciple_1');
    const { data: created } = await disciple1Client
      .from('daily_checklists')
      .insert({ date: TODAY })
      .select('id')
      .single();
    await disciple1Client
      .from('daily_checklists')
      .update({ status: 'submitted' })
      .eq('id', created.id);
    rejectChecklistId = created.id;
  });

  after(async () => {
    await adminClient
      .from('daily_checklists')
      .delete()
      .eq('disciple_id', userIds.disciple_1)
      .eq('date', TODAY);
    await adminClient
      .from('notifications')
      .delete()
      .eq('user_id', userIds.disciple_1)
      .eq('event_type', 'checklist_reviewed');
  });

  it('rejects a non-assigned builder with 403', async () => {
    const builder2Client = await signInAs('builder_2');
    const {
      data: { session },
    } = await builder2Client.auth.getSession();
    const res = await callFunction('review-checklist', session.access_token, {
      checklistId: approveChecklistId,
      decision: 'approved',
    });
    assert.equal(res.status, 403);
  });

  it('rejects needs_redo without a rejectionReason (Zod, PRD Section C.3)', async () => {
    const res = await callFunction('review-checklist', builderToken, {
      checklistId: rejectChecklistId,
      decision: 'needs_redo',
    });
    assert.equal(res.status, 400);
  });

  it('approves a submitted checklist and fires a notification to the disciple', async () => {
    const res = await callFunction('review-checklist', builderToken, {
      checklistId: approveChecklistId,
      decision: 'approved',
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'approved');

    const { data: checklist } = await adminClient
      .from('daily_checklists')
      .select('status, builder_reviewed_at')
      .eq('id', approveChecklistId)
      .single();
    assert.equal(checklist.status, 'approved');
    assert.ok(checklist.builder_reviewed_at);

    const { data: notifications } = await adminClient
      .from('notifications')
      .select('event_type, payload, channel')
      .eq('user_id', userIds.disciple_2)
      .eq('event_type', 'checklist_reviewed');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].payload.status, 'approved');
    assert.equal(notifications[0].channel, 'realtime');
  });

  it('rejects a submitted checklist with a mandatory reason, derives needs_redo -> draft', async () => {
    const res = await callFunction('review-checklist', builderToken, {
      checklistId: rejectChecklistId,
      decision: 'needs_redo',
      rejectionReason: 'Prayer time not logged',
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    // Phase 2's normalize_checklist_status trigger immediately derives
    // needs_redo -> draft (Section C.3: the disciple redoes it that day).
    assert.equal(res.body.status, 'draft');

    const { data: checklist } = await adminClient
      .from('daily_checklists')
      .select('status, rejection_reason')
      .eq('id', rejectChecklistId)
      .single();
    assert.equal(checklist.status, 'draft');
    assert.equal(checklist.rejection_reason, 'Prayer time not logged');
  });

  it('cannot review the same checklist twice (no longer pending_review)', async () => {
    const res = await callFunction('review-checklist', builderToken, {
      checklistId: approveChecklistId,
      decision: 'approved',
    });
    assert.equal(res.status, 409);
  });
});

describe('Graduation recommendation (direct RLS write, column-guarded)', () => {
  let enrollmentId;
  let graduationRequestId;

  before(async () => {
    const { data: enrollment } = await adminClient
      .from('enrollments')
      .insert({ disciple_id: userIds.disciple_2, pathway_id: pathwayId })
      .select('id')
      .single();
    enrollmentId = enrollment.id;

    const { data: gradReq } = await adminClient
      .from('graduation_requests')
      .insert({ enrollment_id: enrollmentId })
      .select('id, status')
      .single();
    graduationRequestId = gradReq.id;
    assert.equal(gradReq.status, 'eligible');
  });

  it('the assigned Builder can recommend graduation (sets builder_at, derives builder_recommended)', async () => {
    const { data, error } = await builderClient
      .from('graduation_requests')
      .update({ builder_at: new Date().toISOString() })
      .eq('id', graduationRequestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'builder_recommended');
  });

  it('a non-assigned builder cannot recommend graduation for this disciple', async () => {
    const builder2Client = await signInAs('builder_2');
    // Reset so this negative test starts from a fresh, un-recommended row.
    await adminClient
      .from('graduation_requests')
      .update({ builder_at: null })
      .eq('id', graduationRequestId);

    const { data } = await builder2Client
      .from('graduation_requests')
      .update({ builder_at: new Date().toISOString() })
      .eq('id', graduationRequestId)
      .select();
    assert.equal(data.length, 0);
  });
});

describe('Weekly check-in "propose 3 times, disciple picks one" (PRD Section C.8)', () => {
  let weeklyCheckinId;
  let proposedTimes;

  before(async () => {
    proposedTimes = [
      new Date(Date.now() + 24 * 3600_000).toISOString(),
      new Date(Date.now() + 48 * 3600_000).toISOString(),
      new Date(Date.now() + 72 * 3600_000).toISOString(),
    ];
  });

  it('the Builder proposes 3 times + a meet link (direct RLS write)', async () => {
    const { data, error } = await builderClient
      .from('weekly_checkins')
      .insert({
        builder_id: userIds.builder_1,
        disciple_id: userIds.disciple_2,
        proposed_times: proposedTimes,
        meet_link: 'https://meet.google.com/abc-defg-hij',
      })
      .select('id, status, proposed_times')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'proposed');
    assert.equal(data.proposed_times.length, 3);
    weeklyCheckinId = data.id;
  });

  it('the disciple cannot pick a time that was not offered', async () => {
    const res = await callFunction('select-checkin-time', discipleToken, {
      weeklyCheckinId,
      chosenTime: new Date(Date.now() + 200 * 3600_000).toISOString(),
    });
    assert.equal(res.status, 400);
  });

  it('a different disciple cannot pick a time on this check-in', async () => {
    const disciple1Client = await signInAs('disciple_1');
    const {
      data: { session },
    } = await disciple1Client.auth.getSession();
    const res = await callFunction('select-checkin-time', session.access_token, {
      weeklyCheckinId,
      chosenTime: proposedTimes[0],
    });
    assert.equal(res.status, 403);
  });

  it('the disciple picks one of the 3 proposed times via the Edge Function', async () => {
    const res = await callFunction('select-checkin-time', discipleToken, {
      weeklyCheckinId,
      chosenTime: proposedTimes[1],
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.status, 'scheduled');
    assert.equal(new Date(res.body.scheduledAt).getTime(), new Date(proposedTimes[1]).getTime());
  });

  it('cannot pick again once scheduled', async () => {
    const res = await callFunction('select-checkin-time', discipleToken, {
      weeklyCheckinId,
      chosenTime: proposedTimes[0],
    });
    assert.equal(res.status, 409);
  });

  it('the Builder submits a post-call report (direct RLS write)', async () => {
    const { data, error } = await builderClient
      .from('weekly_checkins')
      .update({ report: 'Good week, on track with Module 2.', status: 'completed' })
      .eq('id', weeklyCheckinId)
      .select('status, report')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'completed');
    assert.ok(data.report.length > 0);
  });
});
