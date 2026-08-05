// Phase 5: Builder Experience — review-checklist.
// The disciple's own daily_checklists RLS is read-only once submitted
// (Phase 1: "write on draft only"), and Phase 1 already grants the
// assigned Builder a direct RLS UPDATE on this table — so this function
// isn't closing an RLS gap the way create-pathway-request or
// record-test-attempt do. It exists because notifications has no
// authenticated-client INSERT policy at all (Phase 1: only service_role
// writes it), so "approve/reject a checklist" and "notify the disciple of
// the outcome" have to happen atomically from one service_role-backed
// place, or a client crash between the two calls would leave the disciple
// never told their checklist was reviewed.

import { reviewChecklistInputSchema } from '../_shared/schemas.ts';
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
  if (caller.role !== 'builder') {
    return Response.json({ error: 'Only a Builder can review a checklist' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = reviewChecklistInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { checklistId, decision, rejectionReason } = parsed.data;

  const admin = adminClient();

  const { data: checklist, error: checklistError } = await admin
    .from('daily_checklists')
    .select('id, disciple_id, status')
    .eq('id', checklistId)
    .maybeSingle();
  if (checklistError) return Response.json({ error: checklistError.message }, { status: 500 });
  if (!checklist) return Response.json({ error: 'Unknown checklistId' }, { status: 404 });

  const { data: pairing, error: pairingError } = await admin
    .from('builder_disciple')
    .select('builder_id')
    .eq('disciple_id', checklist.disciple_id)
    .eq('status', 'active')
    .maybeSingle();
  if (pairingError) return Response.json({ error: pairingError.message }, { status: 500 });
  if (!pairing || pairing.builder_id !== caller.id) {
    return Response.json(
      { error: 'You are not the assigned Builder for this disciple' },
      { status: 403 },
    );
  }

  if (checklist.status !== 'pending_review') {
    return Response.json(
      { error: `Checklist is '${checklist.status}', not pending_review — nothing to review` },
      { status: 409 },
    );
  }

  const update =
    decision === 'approved'
      ? {
          status: 'approved',
          rejection_reason: null,
          builder_reviewed_at: new Date().toISOString(),
        }
      : {
          status: 'needs_redo',
          rejection_reason: rejectionReason,
          builder_reviewed_at: new Date().toISOString(),
        };

  const { data: updated, error: updateError } = await admin
    .from('daily_checklists')
    .update(update)
    .eq('id', checklistId)
    .select('status')
    .single();
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });

  const { error: notifyError } = await admin.from('notifications').insert({
    user_id: checklist.disciple_id,
    event_type: 'checklist_reviewed',
    payload: { checklist_id: checklistId, status: updated.status },
    channel: 'realtime',
  });
  if (notifyError) return Response.json({ error: notifyError.message }, { status: 500 });

  log.info('daily_checklist.reviewed', {
    userId: caller.id,
    context: { checklistId, decision, status: updated.status },
  });

  return Response.json({ checklistId, status: updated.status });
});
