-- Phase 7: Chat & Prayer Regimen — prayer_sessions table.
-- PRD Section C.7/Section C.3 fix: "prayer regimen done (with its own
-- clock-in/clock-out inside the chat feature)" — a self-report checkbox
-- alone isn't a genuine enough signal (Section E: "'Genuine' prayer
-- regimen verification... reframed to a lighter-touch confirmation").
-- Mirrors module_progress's clock_in_at/clock_out_at pattern rather than
-- reusing that table directly — a prayer session isn't tied to a specific
-- module or enrollment, it's a disciple-level daily activity.
create table public.prayer_sessions (
  id uuid primary key default gen_random_uuid(),
  disciple_id uuid not null references public.users (id) on delete restrict,
  clock_in_at timestamptz not null default now(),
  clock_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prayer_sessions_clock_out_after_clock_in
    check (clock_out_at is null or clock_out_at >= clock_in_at)
);
comment on table public.prayer_sessions is 'One row per prayer clock-in/clock-out, embedded in the Chat screen (Section C.7). No date column: clock_in_at itself is the timestamp of record — a disciple can pray more than once a day.';

create index prayer_sessions_disciple_id_idx on public.prayer_sessions (disciple_id);

create trigger set_updated_at before update on public.prayer_sessions
  for each row execute function public.set_updated_at();

alter table public.prayer_sessions enable row level security;

create policy prayer_sessions_select on public.prayer_sessions
for select
using (
  disciple_id = auth.uid()
  or public.is_builder_of(disciple_id)
  or public.current_user_role() in ('supervising_minister', 'lead_pastor')
);

-- Clock-IN is a simple disciple-driven action, same trust level as
-- module_progress.clock_in_at (Phase 2 comment: "clock-in/out is a simple
-- client-driven action"). Deliberately no UPDATE policy for any
-- authenticated role: clock-OUT goes only through the clock-out-prayer
-- Edge Function (service_role), since that's also the single place that
-- cascades into daily_checklists.prayer_done — a raw client UPDATE here
-- would let a disciple silently skip that cascade.
create policy prayer_sessions_insert on public.prayer_sessions
for insert
with check (disciple_id = auth.uid());
