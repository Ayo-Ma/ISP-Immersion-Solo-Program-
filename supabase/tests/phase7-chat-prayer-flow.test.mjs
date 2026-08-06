// Phase 7 verification: exercises the exact Supabase operations
// apps/mobile/lib/queries/chat.ts, lib/queries/disciple.ts's prayer
// helpers, and the clock-out-prayer Edge Function perform, against the
// real dev database — including an actual Supabase Realtime subscription,
// not just REST-level RLS checks (already covered by rls.test.mjs's
// chat_messages describe block).
//
// Covers the literal Phase 7 Gate: two seeded users (builder_1,
// disciple_1) exchange messages in real time, and a third seeded user
// (builder_2, a different Builder) cannot see that conversation. Also
// covers the prayer regimen clock-in/clock-out cascade into
// daily_checklists.prayer_done, and that the column is genuinely locked
// against a direct client write.
//
// Usage: node --env-file=.env --test supabase/tests/phase7-chat-prayer-flow.test.mjs

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

let userIds;
let builderClient;
let discipleClient;

before(async () => {
  userIds = await loadSeedUserIds();
  await adminClient
    .from('chat_messages')
    .delete()
    .eq('builder_id', userIds.builder_1)
    .eq('disciple_id', userIds.disciple_1)
    .eq('body', 'Phase 7 test message');
  await adminClient.from('prayer_sessions').delete().eq('disciple_id', userIds.disciple_1);
  await adminClient
    .from('daily_checklists')
    .delete()
    .eq('disciple_id', userIds.disciple_1)
    .eq('date', new Date().toISOString().slice(0, 10));

  builderClient = await signInAs('builder_1');
  discipleClient = await signInAs('disciple_1');
});

after(async () => {
  if (!userIds) return; // before() itself failed — nothing was created to tear down
  await adminClient
    .from('chat_messages')
    .delete()
    .eq('builder_id', userIds.builder_1)
    .eq('disciple_id', userIds.disciple_1)
    .eq('body', 'Phase 7 test message');
  await adminClient.from('prayer_sessions').delete().eq('disciple_id', userIds.disciple_1);
  await adminClient
    .from('daily_checklists')
    .delete()
    .eq('disciple_id', userIds.disciple_1)
    .eq('date', new Date().toISOString().slice(0, 10));

  // Without this, an open Realtime WebSocket (heartbeat timer) keeps the
  // node --test process alive indefinitely after the file's tests finish.
  builderClient?.realtime.disconnect();
  discipleClient?.realtime.disconnect();
});

// One attempt at the full subscribe -> insert -> receive round trip. This
// sandbox's WebSocket connection to Realtime occasionally has enough
// latency that a single attempt misses a generous window (seen directly:
// clean passes take 1-2s, a bad one exhausts 20s) — the same class of
// environmental flakiness withRetry already mitigates for plain fetch
// calls elsewhere in this file, just applied to the WebSocket round trip.
async function attemptRealtimeMessage() {
  let channel;
  let settled = false;

  const received = await new Promise((resolve, reject) => {
    const finish = (fn, arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (channel) builderClient.removeChannel(channel);
      fn(arg);
    };

    const timeout = setTimeout(
      () => finish(reject, new Error('Realtime message not received in time')),
      20000,
    );

    channel = builderClient
      .channel(`test-chat:${userIds.disciple_1}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `disciple_id=eq.${userIds.disciple_1}`,
        },
        (payload) => finish(resolve, payload.new),
      )
      .subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          await discipleClient.from('chat_messages').insert({
            builder_id: userIds.builder_1,
            disciple_id: userIds.disciple_1,
            sender_id: userIds.disciple_1,
            body: 'Phase 7 test message',
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          finish(reject, new Error(`Realtime subscribe failed: ${status} ${err?.message ?? ''}`));
        }
      });
  });

  return received;
}

describe('Real-time chat (the Phase 7 Gate)', () => {
  it('the Builder receives a disciple message live via Realtime, and a different Builder cannot see it', async () => {
    const received = await withRetry(attemptRealtimeMessage, 3);

    assert.equal(received.body, 'Phase 7 test message');
    assert.equal(received.sender_id, userIds.disciple_1);

    const builder2Client = await signInAs('builder_2');
    const { data: leaked } = await builder2Client
      .from('chat_messages')
      .select('id')
      .eq('disciple_id', userIds.disciple_1);
    assert.equal(leaked.length, 0, 'a different Builder must not see this conversation');
    builder2Client.realtime.disconnect();
  });
});

describe('Prayer regimen clock-in/clock-out (PRD Section C.7/E)', () => {
  let sessionId;
  let checklistId;

  before(async () => {
    const { data: checklist, error: checklistError } = await withRetry(() =>
      discipleClient
        .from('daily_checklists')
        .insert({ date: new Date().toISOString().slice(0, 10) })
        .select('id')
        .single(),
    );
    if (checklistError) throw checklistError;
    checklistId = checklist.id;

    const { data: session, error: sessionError } = await withRetry(() =>
      discipleClient.from('prayer_sessions').insert({}).select('id').single(),
    );
    if (sessionError) throw sessionError;
    sessionId = session.id;
  });

  it('prayer_done cannot be set by a direct client write (guard trigger)', async () => {
    const { error } = await discipleClient
      .from('daily_checklists')
      .update({ prayer_done: true })
      .eq('id', checklistId);
    assert.ok(error, 'expected the guard trigger to reject this');
  });

  it('a different disciple cannot clock out someone else’s session', async () => {
    const disciple2Client = await signInAs('disciple_2');
    const {
      data: { session },
    } = await disciple2Client.auth.getSession();
    const res = await callFunction('clock-out-prayer', session.access_token, {
      sessionId,
      checklistId,
    });
    assert.equal(res.status, 403);
  });

  it('clocking out cascades prayer_done to true on the checklist', async () => {
    const {
      data: { session: discipleSession },
    } = await discipleClient.auth.getSession();
    const res = await callFunction('clock-out-prayer', discipleSession.access_token, {
      sessionId,
      checklistId,
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.checklistPrayerDone, true);

    const { data: session } = await adminClient
      .from('prayer_sessions')
      .select('clock_out_at')
      .eq('id', sessionId)
      .single();
    assert.ok(session.clock_out_at);

    const { data: checklist } = await adminClient
      .from('daily_checklists')
      .select('prayer_done')
      .eq('id', checklistId)
      .single();
    assert.equal(checklist.prayer_done, true);
  });

  it('cannot clock out the same session twice', async () => {
    const {
      data: { session: discipleSession },
    } = await discipleClient.auth.getSession();
    const res = await callFunction('clock-out-prayer', discipleSession.access_token, {
      sessionId,
      checklistId,
    });
    assert.equal(res.status, 409);
  });
});
