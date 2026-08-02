// Phase 2: Core Domain Logic — reassign-builder.
// Backend System Design Section F2: a reassignment never mutates the
// existing builder_disciple row — it sets status='ended'/ended_at on the
// old row and INSERTs a new one, so the audit trail the feature promises
// is real. Also surfaces the Section C.4b/F soft-cap check (warn, don't
// block) on the new Builder.

import { reassignBuilderInputSchema } from '../_shared/schemas.ts';
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
  if (caller.role !== 'supervising_minister' && caller.role !== 'lead_pastor') {
    return Response.json(
      { error: 'Only a Supervising Minister or Lead Pastor can reassign a Builder' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = reassignBuilderInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { discipleId, newBuilderId, reason } = parsed.data;

  const admin = adminClient();

  const { data: discipleProfile, error: discipleError } = await admin
    .from('users')
    .select('id, role')
    .eq('id', discipleId)
    .maybeSingle();
  if (discipleError) return Response.json({ error: discipleError.message }, { status: 500 });
  if (!discipleProfile || discipleProfile.role !== 'disciple') {
    return Response.json({ error: 'discipleId does not refer to a disciple' }, { status: 404 });
  }

  const { data: builderProfile, error: builderError } = await admin
    .from('users')
    .select('id, role')
    .eq('id', newBuilderId)
    .maybeSingle();
  if (builderError) return Response.json({ error: builderError.message }, { status: 500 });
  if (!builderProfile || builderProfile.role !== 'builder') {
    return Response.json({ error: 'newBuilderId does not refer to a builder' }, { status: 404 });
  }

  const { data: existingPairing, error: existingError } = await admin
    .from('builder_disciple')
    .select('id, builder_id')
    .eq('disciple_id', discipleId)
    .eq('status', 'active')
    .maybeSingle();
  if (existingError) return Response.json({ error: existingError.message }, { status: 500 });

  if (existingPairing && existingPairing.builder_id === newBuilderId) {
    return Response.json(
      { error: 'Disciple is already assigned to this Builder' },
      { status: 409 },
    );
  }

  if (existingPairing) {
    const { error: endError } = await admin
      .from('builder_disciple')
      .update({ status: 'ended', ended_at: new Date().toISOString(), reassignment_reason: reason })
      .eq('id', existingPairing.id);
    if (endError) return Response.json({ error: endError.message }, { status: 500 });
  }

  const { data: newPairing, error: insertError } = await admin
    .from('builder_disciple')
    .insert({
      builder_id: newBuilderId,
      disciple_id: discipleId,
      assigned_by: caller.id,
      status: 'active',
    })
    .select('id')
    .single();
  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  const { data: countResult, error: countError } = await admin.rpc(
    'builder_active_disciple_count',
    { p_builder_id: newBuilderId },
  );
  if (countError) return Response.json({ error: countError.message }, { status: 500 });

  const newBuilderActiveDiscipleCount = countResult as number;
  const builderExceedsCapacitySoftCap = newBuilderActiveDiscipleCount > 12;

  log.info('builder_disciple.reassigned', {
    userId: caller.id,
    context: { discipleId, newBuilderId, previousPairingId: existingPairing?.id ?? null },
  });

  return Response.json({
    newPairingId: newPairing.id,
    newBuilderActiveDiscipleCount,
    builderExceedsCapacitySoftCap,
  });
});
