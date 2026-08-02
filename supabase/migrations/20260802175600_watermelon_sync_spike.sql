-- Phase 1: Backend Foundation — WatermelonDB sync spike (Standing Risk #2).
-- Standalone table, not part of the production schema (Section A) — exists
-- only to prove out the pull/push sync contract against a real Postgres
-- table with RLS enabled, since "no official adapter exists" between
-- WatermelonDB and Supabase and this is the single highest technical-risk
-- item in the build. Drop this table when the spike's outcome is acted on
-- (see docs/WATERMELONDB_SPIKE.md).
--
-- deleted_at (tombstone) is new to this schema — every other table uses
-- status enums for lifecycle, not soft-delete-by-timestamp. WatermelonDB's
-- sync protocol specifically needs to report "deleted since <cursor>" as a
-- set of IDs, which requires a tombstone column. Whether the production
-- schema adopts this same pattern in Phase 9 is exactly the kind of
-- decision this spike exists to inform, not presume.

create table public.spike_sync_notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete restrict,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index spike_sync_notes_owner_id_idx on public.spike_sync_notes (owner_id);
create index spike_sync_notes_updated_at_idx on public.spike_sync_notes (updated_at);

create trigger set_updated_at before update on public.spike_sync_notes
  for each row execute function public.set_updated_at();

alter table public.spike_sync_notes enable row level security;

create policy spike_sync_notes_select on public.spike_sync_notes
for select
using (owner_id = auth.uid());

create policy spike_sync_notes_insert on public.spike_sync_notes
for insert
with check (owner_id = auth.uid());

create policy spike_sync_notes_update on public.spike_sync_notes
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());
