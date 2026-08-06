-- Phase 7: Chat & Prayer Regimen — enable Realtime delivery for chat_messages.
-- Phase 1 created the table and RLS; that alone doesn't make Supabase
-- Realtime deliver INSERT events for it — a table only streams once it's
-- added to the supabase_realtime publication. RLS (already enabled on
-- this table) is what Realtime's postgres_changes then uses to scope
-- delivery per-subscriber, same as it scopes REST reads.
alter publication supabase_realtime add table public.chat_messages;
