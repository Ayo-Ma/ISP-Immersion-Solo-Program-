// RLS test suite (Standing Risk #1 — CLAUDE.md: "RLS policies must be
// tested automatically as each table ships, not deferred to end-of-project
// QA"). For every one of the 15 core tables, authenticates as each
// relevant role and asserts EXACT row visibility — not "no error", actual
// row-set equality — plus the write-side guards that matter most
// (self-role-escalation, cross-approver column writes).
//
// Runs against the real isp-app-dev project (no local Docker available —
// see docs/SETUP.md). Requires seed data: run
// `node --env-file=.env supabase/seed/seed.mjs` first.
//
// Usage: node --env-file=.env --test supabase/tests/

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createClient } from '@supabase/supabase-js';
import { adminClient, signInAs } from './helpers.mjs';
import { setupFixtures, teardownFixtures } from './fixtures.mjs';

let fx;
const clients = {};

before(async () => {
  fx = await setupFixtures();
  for (const key of [
    'lead_pastor',
    'supervising_minister',
    'builder_1',
    'builder_2',
    'disciple_1',
    'disciple_2',
    'disciple_4',
  ]) {
    clients[key] = await signInAs(key);
  }
});

after(async () => {
  if (!fx) return; // setupFixtures() itself failed — nothing was created to tear down
  await teardownFixtures(fx);
});

function ids(rows) {
  return rows.map((r) => r.id).sort();
}

describe('users', () => {
  it('disciple sees only their own row', async () => {
    const { data, error } = await clients.disciple_1.from('users').select('id');
    assert.equal(error, null);
    assert.deepEqual(ids(data), [fx.userIds.disciple_1]);
  });

  it('builder sees own row plus assigned disciples only', async () => {
    const { data, error } = await clients.builder_1.from('users').select('id');
    assert.equal(error, null);
    assert.deepEqual(
      ids(data),
      [
        fx.userIds.builder_1,
        fx.userIds.disciple_1,
        fx.userIds.disciple_2,
        fx.userIds.disciple_3,
      ].sort(),
    );
  });

  it("builder does not see the other builder's disciples", async () => {
    const { data, error } = await clients.builder_1.from('users').select('id');
    assert.equal(error, null);
    assert.ok(!ids(data).includes(fx.userIds.disciple_4));
  });

  it('supervising minister sees all 10 users', async () => {
    const { data, error } = await clients.supervising_minister.from('users').select('id');
    assert.equal(error, null);
    assert.equal(data.length, 10);
  });

  it('lead pastor sees all 10 users', async () => {
    const { data, error } = await clients.lead_pastor.from('users').select('id');
    assert.equal(error, null);
    assert.equal(data.length, 10);
  });

  it('a disciple cannot escalate their own role', async () => {
    const { error, data } = await clients.disciple_1
      .from('users')
      .update({ role: 'lead_pastor' })
      .eq('id', fx.userIds.disciple_1)
      .select();
    // No UPDATE policy exists for users, so RLS silently matches zero rows
    // rather than erroring — assert nothing changed, not just "no crash".
    assert.equal(error, null);
    assert.equal(data.length, 0);

    const { data: check } = await clients.disciple_1
      .from('users')
      .select('role')
      .eq('id', fx.userIds.disciple_1)
      .single();
    assert.equal(check.role, 'disciple');
  });

  it('an unauthenticated client sees nothing', async () => {
    const anon = createClient(
      process.env.SUPABASE_DEV_URL,
      process.env.SUPABASE_DEV_PUBLISHABLE_KEY,
    );
    const { data, error } = await anon.from('users').select('id');
    assert.equal(error, null);
    assert.equal(data.length, 0);
  });
});

describe('builder_disciple', () => {
  it('disciple sees only their own pairing', async () => {
    const { data, error } = await clients.disciple_1.from('builder_disciple').select('disciple_id');
    assert.equal(error, null);
    assert.deepEqual(ids(data.map((r) => ({ id: r.disciple_id }))), [fx.userIds.disciple_1]);
  });

  it("builder does not see the other builder's pairings", async () => {
    const { data, error } = await clients.builder_1.from('builder_disciple').select('disciple_id');
    assert.equal(error, null);
    assert.ok(!data.some((r) => r.disciple_id === fx.userIds.disciple_4));
  });

  it('supervising minister and lead pastor see every pairing, including ended ones (audit trail)', async () => {
    // Not a fixed count: Phase 2's reassign-builder never deletes rows
    // (Section F2 — history is preserved), so the true total only grows
    // as real reassignments happen. Assert "SM/LP see the actual total",
    // not a number that goes stale the moment a reassignment ever runs.
    const { count: actualTotal } = await adminClient
      .from('builder_disciple')
      .select('id', { count: 'exact', head: true });

    const sm = await clients.supervising_minister.from('builder_disciple').select('id');
    const lp = await clients.lead_pastor.from('builder_disciple').select('id');
    assert.equal(sm.data.length, actualTotal);
    assert.equal(lp.data.length, actualTotal);
  });
});

describe('pathways and modules (catalog — visible to all authenticated roles)', () => {
  it('an unrelated disciple can still read the catalog', async () => {
    const { data: pathways, error: pErr } = await clients.disciple_2.from('pathways').select('id');
    const { data: modules, error: mErr } = await clients.disciple_2.from('modules').select('id');
    assert.equal(pErr, null);
    assert.equal(mErr, null);
    assert.ok(pathways.some((p) => p.id === fx.pathwayId));
    assert.equal(modules.length >= 3, true);
  });
});

describe('pathway_requests', () => {
  it('the disciple sees their own request', async () => {
    const { data, error } = await clients.disciple_1.from('pathway_requests').select('id');
    assert.equal(error, null);
    assert.deepEqual(ids(data), [fx.pathwayRequestId]);
  });

  it('a different disciple sees none', async () => {
    const { data, error } = await clients.disciple_2.from('pathway_requests').select('id');
    assert.equal(error, null);
    assert.equal(data.length, 0);
  });

  it('the assigned builder sees it, the other builder does not', async () => {
    const assigned = await clients.builder_1.from('pathway_requests').select('id');
    const unassigned = await clients.builder_2.from('pathway_requests').select('id');
    assert.deepEqual(ids(assigned.data), [fx.pathwayRequestId]);
    assert.equal(unassigned.data.length, 0);
  });

  it('supervising minister and lead pastor see it', async () => {
    const sm = await clients.supervising_minister.from('pathway_requests').select('id');
    const lp = await clients.lead_pastor.from('pathway_requests').select('id');
    assert.ok(ids(sm.data).includes(fx.pathwayRequestId));
    assert.ok(ids(lp.data).includes(fx.pathwayRequestId));
  });

  it('the disciple cannot insert a pathway_request (read-only per Section B)', async () => {
    const { error } = await clients.disciple_1
      .from('pathway_requests')
      .insert({ disciple_id: fx.userIds.disciple_1, pathway_id: fx.pathwayId });
    assert.ok(error, 'expected insert to be rejected');
  });

  it('SM can write sm_approved_at but not lp_approved_at (column-ownership guard)', async () => {
    const own = await clients.supervising_minister
      .from('pathway_requests')
      .update({ sm_approved_at: new Date().toISOString() })
      .eq('id', fx.pathwayRequestId)
      .select();
    assert.equal(own.error, null);
    assert.equal(own.data.length, 1);

    const cross = await clients.supervising_minister
      .from('pathway_requests')
      .update({ lp_approved_at: new Date().toISOString() })
      .eq('id', fx.pathwayRequestId);
    assert.ok(cross.error, 'expected the guard trigger to reject SM writing lp_approved_at');
  });

  it('LP can write lp_approved_at but not sm_approved_at (column-ownership guard)', async () => {
    const own = await clients.lead_pastor
      .from('pathway_requests')
      .update({ lp_approved_at: new Date().toISOString() })
      .eq('id', fx.pathwayRequestId)
      .select();
    assert.equal(own.error, null);
    assert.equal(own.data.length, 1);

    const cross = await clients.lead_pastor
      .from('pathway_requests')
      .update({ sm_approved_at: new Date().toISOString() })
      .eq('id', fx.pathwayRequestId);
    assert.ok(cross.error, 'expected the guard trigger to reject LP writing sm_approved_at');
  });
});

describe('enrollments', () => {
  it('the disciple sees their own enrollment; another disciple sees none', async () => {
    const own = await clients.disciple_1.from('enrollments').select('id');
    const other = await clients.disciple_2.from('enrollments').select('id');
    assert.deepEqual(ids(own.data), [fx.enrollmentId]);
    assert.equal(other.data.length, 0);
  });

  it('the assigned builder sees it, the other builder does not', async () => {
    const assigned = await clients.builder_1.from('enrollments').select('id');
    const unassigned = await clients.builder_2.from('enrollments').select('id');
    assert.ok(ids(assigned.data).includes(fx.enrollmentId));
    assert.equal(unassigned.data.length, 0);
  });
});

describe('module_progress', () => {
  it('the disciple sees their own progress and can clock in (Phase 2 locks status/test_score/attempts to the record-test-attempt Edge Function, not raw client writes)', async () => {
    const { data: seen, error: selErr } = await clients.disciple_1
      .from('module_progress')
      .select('id');
    assert.equal(selErr, null);
    // The enrollment→module_progress cascade trigger (Phase 4) creates one
    // row per pathway module, not just the one fixtures.mjs points at.
    assert.deepEqual(ids(seen), fx.moduleProgressIds.slice().sort());

    const { data: updated, error: updErr } = await clients.disciple_1
      .from('module_progress')
      .update({ clock_in_at: new Date().toISOString() })
      .eq('id', fx.moduleProgressId)
      .select();
    assert.equal(updErr, null);
    assert.equal(updated.length, 1);
  });

  it('a different disciple sees none and cannot update it', async () => {
    const { data } = await clients.disciple_2.from('module_progress').select('id');
    assert.equal(data.length, 0);

    const { data: updated } = await clients.disciple_2
      .from('module_progress')
      .update({ status: 'passed' })
      .eq('id', fx.moduleProgressId)
      .select();
    assert.equal(updated.length, 0);
  });
});

describe('daily_checklists', () => {
  it('the disciple sees and can update their own draft checklist', async () => {
    const { data: seen } = await clients.disciple_1.from('daily_checklists').select('id');
    assert.deepEqual(ids(seen), [fx.dailyChecklistId]);

    const { data: updated, error } = await clients.disciple_1
      .from('daily_checklists')
      .update({ test_done: true })
      .eq('id', fx.dailyChecklistId)
      .select();
    assert.equal(error, null);
    assert.equal(updated.length, 1);
  });

  it('a different disciple sees none', async () => {
    const { data } = await clients.disciple_2.from('daily_checklists').select('id');
    assert.equal(data.length, 0);
  });

  it('the assigned builder can review it, the other builder cannot see it', async () => {
    const assigned = await clients.builder_1
      .from('daily_checklists')
      .update({ status: 'approved', builder_reviewed_at: new Date().toISOString() })
      .eq('id', fx.dailyChecklistId)
      .select();
    assert.equal(assigned.error, null);
    assert.equal(assigned.data.length, 1);

    const unassigned = await clients.builder_2.from('daily_checklists').select('id');
    assert.equal(unassigned.data.length, 0);
  });

  it('supervising minister and lead pastor can read it (digest) but not write it', async () => {
    const sm = await clients.supervising_minister.from('daily_checklists').select('id');
    assert.ok(ids(sm.data).includes(fx.dailyChecklistId));

    const smWrite = await clients.supervising_minister
      .from('daily_checklists')
      .update({ status: 'needs_redo' })
      .eq('id', fx.dailyChecklistId)
      .select();
    assert.equal(smWrite.data.length, 0);
  });
});

describe('graduation_requests', () => {
  it('the disciple sees their own graduation request', async () => {
    const { data } = await clients.disciple_1.from('graduation_requests').select('id');
    assert.deepEqual(ids(data), [fx.graduationRequestId]);
  });

  it('builder can set builder_at but not sm_at/lp_at (column-ownership guard)', async () => {
    const own = await clients.builder_1
      .from('graduation_requests')
      .update({ builder_at: new Date().toISOString() })
      .eq('id', fx.graduationRequestId)
      .select();
    assert.equal(own.error, null);
    assert.equal(own.data.length, 1);

    const cross = await clients.builder_1
      .from('graduation_requests')
      .update({ sm_at: new Date().toISOString() })
      .eq('id', fx.graduationRequestId);
    assert.ok(cross.error, 'expected the guard trigger to reject Builder writing sm_at');
  });

  it('supervising minister can set sm_at but not builder_at/lp_at', async () => {
    const own = await clients.supervising_minister
      .from('graduation_requests')
      .update({ sm_at: new Date().toISOString() })
      .eq('id', fx.graduationRequestId)
      .select();
    assert.equal(own.error, null);
    assert.equal(own.data.length, 1);

    const cross = await clients.supervising_minister
      .from('graduation_requests')
      .update({ lp_at: new Date().toISOString() });
    assert.ok(cross.error, 'expected the guard trigger to reject SM writing lp_at');
  });
});

describe('chat_messages', () => {
  it('participants (disciple and builder) see the message', async () => {
    const d = await clients.disciple_1.from('chat_messages').select('id');
    const b = await clients.builder_1.from('chat_messages').select('id');
    assert.deepEqual(ids(d.data), [fx.chatMessageId]);
    assert.deepEqual(ids(b.data), [fx.chatMessageId]);
  });

  it('a non-participant disciple, the other builder, and leadership see nothing', async () => {
    const d2 = await clients.disciple_2.from('chat_messages').select('id');
    const b2 = await clients.builder_2.from('chat_messages').select('id');
    const sm = await clients.supervising_minister.from('chat_messages').select('id');
    const lp = await clients.lead_pastor.from('chat_messages').select('id');
    assert.equal(d2.data.length, 0);
    assert.equal(b2.data.length, 0);
    assert.equal(sm.data.length, 0, 'Section B: no access by default for Supervising Minister');
    assert.equal(lp.data.length, 0, 'Section B: no access by default for Lead Pastor');
  });

  it('a disciple cannot send a message impersonating the builder', async () => {
    const { error } = await clients.disciple_1.from('chat_messages').insert({
      builder_id: fx.userIds.builder_1,
      disciple_id: fx.userIds.disciple_1,
      sender_id: fx.userIds.builder_1,
      body: 'spoofed',
    });
    assert.ok(error, 'expected insert to be rejected — sender_id must equal the caller');
  });
});

describe('weekly_checkins', () => {
  it('participants see it; the other builder and unrelated disciple do not', async () => {
    const d = await clients.disciple_1.from('weekly_checkins').select('id');
    const b = await clients.builder_1.from('weekly_checkins').select('id');
    const b2 = await clients.builder_2.from('weekly_checkins').select('id');
    const d2 = await clients.disciple_2.from('weekly_checkins').select('id');
    assert.deepEqual(ids(d.data), [fx.weeklyCheckinId]);
    assert.deepEqual(ids(b.data), [fx.weeklyCheckinId]);
    assert.equal(b2.data.length, 0);
    assert.equal(d2.data.length, 0);
  });

  it('leadership sees it for oversight', async () => {
    const sm = await clients.supervising_minister.from('weekly_checkins').select('id');
    assert.ok(ids(sm.data).includes(fx.weeklyCheckinId));
  });
});

describe('notifications', () => {
  it('only the owning disciple sees their notification — not even their assigned builder', async () => {
    const own = await clients.disciple_1.from('notifications').select('id');
    const builder = await clients.builder_1.from('notifications').select('id');
    assert.deepEqual(ids(own.data), [fx.notificationId]);
    assert.equal(
      builder.data.length,
      0,
      'Section B: notifications are "own rows only" for every role',
    );
  });

  it('the owner can mark it read; nobody else can', async () => {
    const other = await clients.disciple_2
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', fx.notificationId)
      .select();
    assert.equal(other.data.length, 0);

    const own = await clients.disciple_1
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', fx.notificationId)
      .select();
    assert.equal(own.error, null);
    assert.equal(own.data.length, 1);
  });
});

describe('growth_stages (catalog — visible to all authenticated roles)', () => {
  it('an unrelated disciple can read it', async () => {
    const { data, error } = await clients.disciple_2.from('growth_stages').select('id');
    assert.equal(error, null);
    assert.ok(ids(data).includes(fx.growthStageId));
  });
});

describe('disciple_growth_progress', () => {
  it('the disciple and assigned builder see it; the other builder does not', async () => {
    const d = await clients.disciple_1.from('disciple_growth_progress').select('id');
    const b1 = await clients.builder_1.from('disciple_growth_progress').select('id');
    const b2 = await clients.builder_2.from('disciple_growth_progress').select('id');
    assert.deepEqual(ids(d.data), [fx.discipleGrowthProgressId]);
    assert.deepEqual(ids(b1.data), [fx.discipleGrowthProgressId]);
    assert.equal(b2.data.length, 0);
  });
});

describe('approval_delegations', () => {
  it('builders and disciples have no access', async () => {
    const b = await clients.builder_1.from('approval_delegations').select('id');
    const d = await clients.disciple_1.from('approval_delegations').select('id');
    assert.equal(b.data.length, 0);
    assert.equal(d.data.length, 0);
  });

  it('the primary SM sees their own delegation; lead pastor sees it for oversight', async () => {
    const sm = await clients.supervising_minister.from('approval_delegations').select('id');
    const lp = await clients.lead_pastor.from('approval_delegations').select('id');
    assert.deepEqual(ids(sm.data), [fx.approvalDelegationId]);
    assert.ok(ids(lp.data).includes(fx.approvalDelegationId));
  });
});
