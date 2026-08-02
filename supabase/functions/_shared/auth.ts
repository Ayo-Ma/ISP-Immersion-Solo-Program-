// Deno runtime (Supabase Edge Functions). Shared "who is calling, and what
// role do they have" helper for Phase 2 Edge Functions — each one needs
// this, and each enforces a DIFFERENT role requirement on top of it, so
// only the identity+role lookup is factored out, not the authorization
// decision itself.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
}

export interface Caller {
  id: string;
  role: string;
}

export async function getCaller(req: Request): Promise<Caller | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;

  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: authData, error: authError } = await callerClient.auth.getUser();
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await adminClient()
    .from('users')
    .select('role')
    .eq('id', authData.user.id)
    .single();
  if (profileError || !profile) return null;

  return { id: authData.user.id, role: profile.role as string };
}
