// Phase 2: Core Domain Logic — create-pathway-request.
// The only write path for pathway_requests.INSERT: Phase 1 RLS deliberately
// gives disciples read-only access to this table (Section B: "Own rows,
// read only"), so creation has to happen here, with service_role, after
// this function's own checks — not a raw client insert.

import { createPathwayRequestInputSchema } from '../_shared/schemas.ts';
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
    return Response.json({ error: 'Only disciples can submit a pathway request' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createPathwayRequestInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { pathwayId } = parsed.data;

  const admin = adminClient();

  const { data: pathway, error: pathwayError } = await admin
    .from('pathways')
    .select('id')
    .eq('id', pathwayId)
    .maybeSingle();
  if (pathwayError) return Response.json({ error: pathwayError.message }, { status: 500 });
  if (!pathway) return Response.json({ error: 'Unknown pathwayId' }, { status: 404 });

  // PRD Section C.1 fix: one active pathway at a time. enrollments already
  // enforces this at the DB level (Phase 1's partial unique index) once
  // approved; this checks the pending-request side of the same rule,
  // since a second simultaneous *request* isn't blocked by that index.
  const { data: pendingRequests, error: pendingError } = await admin
    .from('pathway_requests')
    .select('id')
    .eq('disciple_id', caller.id)
    .in('status', ['requested', 'under_review']);
  if (pendingError) return Response.json({ error: pendingError.message }, { status: 500 });
  if (pendingRequests && pendingRequests.length > 0) {
    return Response.json(
      { error: 'A pathway request is already pending (Section C.1: one active pathway at a time)' },
      { status: 409 },
    );
  }

  const { data: activeEnrollment, error: enrollmentError } = await admin
    .from('enrollments')
    .select('id')
    .eq('disciple_id', caller.id)
    .eq('status', 'active')
    .maybeSingle();
  if (enrollmentError) return Response.json({ error: enrollmentError.message }, { status: 500 });
  if (activeEnrollment) {
    return Response.json(
      {
        error: 'Already enrolled in an active pathway (Section C.1: one active pathway at a time)',
      },
      { status: 409 },
    );
  }

  const { data: created, error: insertError } = await admin
    .from('pathway_requests')
    .insert({ disciple_id: caller.id, pathway_id: pathwayId })
    .select('id, status')
    .single();
  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  log.info('pathway_request.created', {
    userId: caller.id,
    context: { pathwayRequestId: created.id, pathwayId },
  });

  return Response.json({ pathwayRequestId: created.id, status: created.status });
});
