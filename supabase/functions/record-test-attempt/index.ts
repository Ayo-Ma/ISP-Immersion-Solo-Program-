// Phase 2: Core Domain Logic — record-test-attempt.
// Backend System Design Section C.2 fix: a failed test requires the
// disciple to rewatch the lesson before a retake unlocks, with a short
// cooldown between attempts. Section F fix: three failed attempts
// auto-notifies the Builder. This is the sole write path for
// module_progress's grading/gating columns (Phase 2 migration
// 20260802184100 locks them to service_role via a guard trigger) — a
// direct client PATCH would bypass all of the gating below.

import { recordTestAttemptInputSchema } from '../_shared/schemas.ts';
import { adminClient, getCaller } from '../_shared/auth.ts';
import { log } from '../_shared/logger.ts';

const PASS_MARK = 65;
const COOLDOWN_MINUTES = 15;
const THREE_STRIKES_ATTEMPTS = 3;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const caller = await getCaller(req);
  if (!caller) {
    return Response.json({ error: 'Invalid or missing session' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = recordTestAttemptInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { moduleProgressId, score } = parsed.data;

  const admin = adminClient();

  const { data: progress, error: progressError } = await admin
    .from('module_progress')
    .select('id, enrollment_id, attempts, status, rewatched_at, failed_at, cooldown_until')
    .eq('id', moduleProgressId)
    .maybeSingle();
  if (progressError) return Response.json({ error: progressError.message }, { status: 500 });
  if (!progress) return Response.json({ error: 'Unknown moduleProgressId' }, { status: 404 });

  const { data: enrollment, error: enrollmentError } = await admin
    .from('enrollments')
    .select('disciple_id')
    .eq('id', progress.enrollment_id)
    .single();
  if (enrollmentError) return Response.json({ error: enrollmentError.message }, { status: 500 });

  if (caller.role !== 'disciple' || enrollment.disciple_id !== caller.id) {
    return Response.json(
      { error: 'Only the enrolled disciple can submit a test attempt for this module' },
      { status: 403 },
    );
  }

  if (progress.attempts > 0 && progress.status === 'failed') {
    const rewatched =
      progress.rewatched_at != null &&
      progress.failed_at != null &&
      new Date(progress.rewatched_at) > new Date(progress.failed_at);
    if (!rewatched) {
      return Response.json(
        { error: 'Rewatch the lesson before retaking the test (Section C.2 fix).' },
        { status: 409 },
      );
    }

    const cooldownActive =
      progress.cooldown_until != null && new Date(progress.cooldown_until) > new Date();
    if (cooldownActive) {
      return Response.json(
        { error: `Retake is on cooldown until ${progress.cooldown_until}.` },
        { status: 409 },
      );
    }
  }

  const attempts = progress.attempts + 1;
  const passed = score >= PASS_MARK;

  const update = passed
    ? { status: 'passed', attempts }
    : {
        status: 'failed',
        attempts,
        rewatch_required: true,
        failed_at: new Date().toISOString(),
        cooldown_until: new Date(Date.now() + COOLDOWN_MINUTES * 60_000).toISOString(),
      };

  const { data: updated, error: updateError } = await admin
    .from('module_progress')
    .update({ ...update, test_score: score })
    .eq('id', moduleProgressId)
    .select('status, attempts, rewatch_required, cooldown_until')
    .single();
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  let builderAlerted = false;
  if (!passed && attempts === THREE_STRIKES_ATTEMPTS) {
    const { data: pairing, error: pairingError } = await admin
      .from('builder_disciple')
      .select('builder_id')
      .eq('disciple_id', enrollment.disciple_id)
      .eq('status', 'active')
      .maybeSingle();
    if (pairingError) return Response.json({ error: pairingError.message }, { status: 500 });

    if (pairing) {
      const { error: notifyError } = await admin.from('notifications').insert({
        user_id: pairing.builder_id,
        event_type: 'test_three_failures',
        payload: { module_progress_id: moduleProgressId, disciple_id: enrollment.disciple_id },
        channel: 'realtime',
      });
      if (notifyError) return Response.json({ error: notifyError.message }, { status: 500 });
      builderAlerted = true;
    }
  }

  log.info('module_progress.test_attempt_recorded', {
    userId: caller.id,
    context: { moduleProgressId, attempts, passed, builderAlerted },
  });

  return Response.json({
    status: updated.status,
    attempts: updated.attempts,
    rewatchRequired: updated.rewatch_required,
    cooldownUntil: updated.cooldown_until,
    builderAlerted,
  });
});
