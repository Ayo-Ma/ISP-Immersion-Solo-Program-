import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../supabase';

/**
 * Phase 7 data layer — chat_messages RLS (Phase 1) already scopes every
 * read/write to the caller's own conversation (their disciple_id or
 * builder_id), so a query here naturally can't leak into another pairing's
 * thread. Realtime delivery is scoped by the same RLS policy (Phase 7
 * migration: chat_messages added to the supabase_realtime publication).
 */

export interface ChatMessageRow {
  id: string;
  builder_id: string;
  disciple_id: string;
  sender_id: string;
  body: string;
  sent_at: string;
}

export async function listMessages(
  builderId: string,
  discipleId: string,
): Promise<ChatMessageRow[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, builder_id, disciple_id, sender_id, body, sent_at')
    .eq('builder_id', builderId)
    .eq('disciple_id', discipleId)
    .order('sent_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendMessage(params: {
  builderId: string;
  discipleId: string;
  senderId: string;
  body: string;
}): Promise<ChatMessageRow> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      builder_id: params.builderId,
      disciple_id: params.discipleId,
      sender_id: params.senderId,
      body: params.body,
    })
    .select('id, builder_id, disciple_id, sender_id, body, sent_at')
    .single();
  if (error) throw error;
  return data;
}

/**
 * disciple_id alone is a sufficient Realtime filter: it already uniquely
 * identifies one conversation pair in practice (Phase 1's unique index
 * caps a disciple to one active Builder at a time), so there's no need
 * for a compound builder_id+disciple_id filter on the channel.
 */
export function subscribeToMessages(
  discipleId: string,
  onInsert: (message: ChatMessageRow) => void,
): RealtimeChannel {
  return supabase
    .channel(`chat:${discipleId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `disciple_id=eq.${discipleId}`,
      },
      (payload) => onInsert(payload.new as ChatMessageRow),
    )
    .subscribe();
}

export function unsubscribe(channel: RealtimeChannel): void {
  supabase.removeChannel(channel);
}
