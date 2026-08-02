// Phase 1: WatermelonDB sync spike (Standing Risk #2). Implements the
// pull/push HTTP contract WatermelonDB's `synchronize()` expects, against
// the spike_sync_notes table (see migration 20260802175600). This is the
// actual risk being spiked — "no official adapter exists" between
// WatermelonDB and Supabase, so this hand-rolled contract IS the adapter.
//
// GET  ?last_pulled_at=<ms epoch, omitted on first sync>
//      -> { changes: { spike_sync_notes: { created, updated, deleted } }, timestamp }
// POST { changes: { spike_sync_notes: { created, updated, deleted } }, last_pulled_at }
//      -> { success: true }
//
// Runs with the CALLER's JWT, not service_role, so RLS on
// spike_sync_notes (owner_id = auth.uid()) is what actually enforces a
// user can only sync their own rows — proving RLS and the sync protocol
// compose correctly, not just that the endpoint responds.

import { createClient } from 'npm:@supabase/supabase-js@2';

interface RawRecord {
  id: string;
  note: string;
}

interface PushBody {
  changes: {
    spike_sync_notes?: {
      created?: RawRecord[];
      updated?: RawRecord[];
      deleted?: string[];
    };
  };
  last_pulled_at: number | null;
}

function supabaseForRequest(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    throw new Response('Missing Authorization header', { status: 401 });
  }

  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
}

async function handlePull(req: Request): Promise<Response> {
  const supabase = supabaseForRequest(req);
  const url = new URL(req.url);
  const lastPulledAtParam = url.searchParams.get('last_pulled_at');
  const cursor = lastPulledAtParam ? new Date(Number(lastPulledAtParam)).toISOString() : null;
  const now = new Date();

  let created: RawRecord[] = [];
  let updated: RawRecord[] = [];
  let deleted: string[] = [];

  if (cursor === null) {
    // First sync: everything not deleted counts as "created".
    const { data, error } = await supabase
      .from('spike_sync_notes')
      .select('id, note')
      .is('deleted_at', null);
    if (error) return Response.json({ error: error.message }, { status: 400 });
    created = data ?? [];
  } else {
    const { data: createdRows, error: createdError } = await supabase
      .from('spike_sync_notes')
      .select('id, note')
      .is('deleted_at', null)
      .gt('created_at', cursor);
    if (createdError) return Response.json({ error: createdError.message }, { status: 400 });
    created = createdRows ?? [];

    const { data: updatedRows, error: updatedError } = await supabase
      .from('spike_sync_notes')
      .select('id, note')
      .is('deleted_at', null)
      .gt('updated_at', cursor)
      .lte('created_at', cursor);
    if (updatedError) return Response.json({ error: updatedError.message }, { status: 400 });
    updated = updatedRows ?? [];

    const { data: deletedRows, error: deletedError } = await supabase
      .from('spike_sync_notes')
      .select('id')
      .not('deleted_at', 'is', null)
      .gt('deleted_at', cursor);
    if (deletedError) return Response.json({ error: deletedError.message }, { status: 400 });
    deleted = (deletedRows ?? []).map((r: { id: string }) => r.id);
  }

  return Response.json({
    changes: { spike_sync_notes: { created, updated, deleted } },
    timestamp: now.getTime(),
  });
}

async function handlePush(req: Request): Promise<Response> {
  const supabase = supabaseForRequest(req);
  const body: PushBody = await req.json();
  const notes = body.changes.spike_sync_notes;
  if (!notes) return Response.json({ success: true });

  for (const record of notes.created ?? []) {
    const { error } = await supabase.from('spike_sync_notes').insert({
      id: record.id,
      note: record.note,
      owner_id: (await supabase.auth.getUser()).data.user?.id,
    });
    if (error)
      return Response.json({ error: `create ${record.id}: ${error.message}` }, { status: 400 });
  }

  for (const record of notes.updated ?? []) {
    const { error } = await supabase
      .from('spike_sync_notes')
      .update({ note: record.note })
      .eq('id', record.id);
    if (error)
      return Response.json({ error: `update ${record.id}: ${error.message}` }, { status: 400 });
  }

  for (const id of notes.deleted ?? []) {
    const { error } = await supabase
      .from('spike_sync_notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return Response.json({ error: `delete ${id}: ${error.message}` }, { status: 400 });
  }

  return Response.json({ success: true });
}

Deno.serve(async (req) => {
  try {
    if (req.method === 'GET') return await handlePull(req);
    if (req.method === 'POST') return await handlePush(req);
    return new Response('Method not allowed', { status: 405 });
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json({ error: String(err) }, { status: 500 });
  }
});
