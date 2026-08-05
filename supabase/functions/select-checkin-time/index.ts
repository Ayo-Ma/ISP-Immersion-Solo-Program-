// Phase 5: Builder Experience — select-checkin-time.
// PRD Section C.8: "propose 3 times, disciple picks one." Phase 1 RLS
// deliberately leaves weekly_checkins disciple-read-only (only the
// assigned Builder has an INSERT/UPDATE policy), so the disciple's "pick
// one of the 3" action has no raw-client write path — and needs one
// regardless, since picking has to be validated against the specific
// times the Builder actually offered, not accepted as arbitrary client
// input.

import { selectCheckinTimeInputSchema } from '../_shared/schemas.ts';
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
    return Response.json(
      { error: 'Only the disciple being scheduled can pick a check-in time' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = selectCheckinTimeInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { weeklyCheckinId, chosenTime } = parsed.data;

  const admin = adminClient();

  const { data: checkin, error: checkinError } = await admin
    .from('weekly_checkins')
    .select('id, disciple_id, status, proposed_times')
    .eq('id', weeklyCheckinId)
    .maybeSingle();
  if (checkinError) return Response.json({ error: checkinError.message }, { status: 500 });
  if (!checkin) return Response.json({ error: 'Unknown weeklyCheckinId' }, { status: 404 });

  if (checkin.disciple_id !== caller.id) {
    return Response.json({ error: 'This check-in was not proposed to you' }, { status: 403 });
  }

  if (checkin.status !== 'proposed') {
    return Response.json(
      { error: `Check-in is '${checkin.status}', not proposed — nothing to pick` },
      { status: 409 },
    );
  }

  const offered = (checkin.proposed_times ?? []).some(
    (t: string) => new Date(t).getTime() === new Date(chosenTime).getTime(),
  );
  if (!offered) {
    return Response.json(
      { error: 'chosenTime was not one of the times the Builder proposed' },
      { status: 400 },
    );
  }

  const { data: updated, error: updateError } = await admin
    .from('weekly_checkins')
    .update({ scheduled_at: chosenTime, status: 'scheduled' })
    .eq('id', weeklyCheckinId)
    .select('status, scheduled_at')
    .single();
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  log.info('weekly_checkin.time_selected', {
    userId: caller.id,
    context: { weeklyCheckinId, scheduledAt: updated.scheduled_at },
  });

  return Response.json({
    weeklyCheckinId,
    status: updated.status,
    scheduledAt: updated.scheduled_at,
  });
});
