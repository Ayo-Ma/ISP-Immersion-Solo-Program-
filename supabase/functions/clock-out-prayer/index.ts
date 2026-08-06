// Phase 7: Chat & Prayer Regimen — clock-out-prayer.
// Closes a prayer_sessions row and, if the checklist is still editable,
// cascades to daily_checklists.prayer_done. That column is now locked to
// service_role (Phase 7 migration 20260806120200) precisely so this is
// the only place it can move — a raw client PATCH would let a disciple
// check the box without ever using the clock-in/out flow, which is the
// exact "genuine verification" gap PRD Section E flags.

import { clockOutPrayerInputSchema } from '../_shared/schemas.ts';
import { adminClient, getCaller } from '../_shared/auth.ts';
import { log } from '../_shared/logger.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const caller = await getCaller(req);
  if (!caller) {
    return Response.json({ error: 'Invalid or missing session' }, { status: 401 });
  }
  if (caller.role !== 'disciple') {
    return Response.json({ error: 'Only a disciple can clock out of prayer' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = clockOutPrayerInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { sessionId, checklistId } = parsed.data;

  const admin = adminClient();

  const { data: session, error: sessionError } = await admin
    .from('prayer_sessions')
    .select('id, disciple_id, clock_in_at, clock_out_at')
    .eq('id', sessionId)
    .maybeSingle();
  if (sessionError) return Response.json({ error: sessionError.message }, { status: 500 });
  if (!session) return Response.json({ error: 'Unknown sessionId' }, { status: 404 });
  if (session.disciple_id !== caller.id) {
    return Response.json({ error: 'This prayer session is not yours' }, { status: 403 });
  }
  if (session.clock_out_at) {
    return Response.json({ error: 'This prayer session is already clocked out' }, { status: 409 });
  }

  const { data: checklist, error: checklistError } = await admin
    .from('daily_checklists')
    .select('id, disciple_id, status, prayer_done')
    .eq('id', checklistId)
    .maybeSingle();
  if (checklistError) return Response.json({ error: checklistError.message }, { status: 500 });
  if (!checklist) return Response.json({ error: 'Unknown checklistId' }, { status: 404 });
  if (checklist.disciple_id !== caller.id) {
    return Response.json({ error: 'This checklist is not yours' }, { status: 403 });
  }
  if (checklist.status !== 'draft') {
    return Response.json(
      { error: `Checklist is '${checklist.status}', not draft — cannot update prayer_done` },
      { status: 409 },
    );
  }

  const clockOutAt = new Date().toISOString();

  const { error: updateSessionError } = await admin
    .from('prayer_sessions')
    .update({ clock_out_at: clockOutAt })
    .eq('id', sessionId);
  if (updateSessionError) {
    return Response.json({ error: updateSessionError.message }, { status: 500 });
  }

  if (!checklist.prayer_done) {
    const { error: updateChecklistError } = await admin
      .from('daily_checklists')
      .update({ prayer_done: true })
      .eq('id', checklistId);
    if (updateChecklistError) {
      return Response.json({ error: updateChecklistError.message }, { status: 500 });
    }
  }

  log.info('prayer_session.clocked_out', {
    userId: caller.id,
    context: { sessionId, checklistId },
  });

  return Response.json({
    sessionId,
    clockOutAt,
    checklistPrayerDone: true,
  });
});
