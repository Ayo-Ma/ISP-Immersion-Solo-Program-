-- Phase 2: Core Domain Logic — module_progress retake logic.
-- Backend System Design Section C.2 fix: a failed test requires the
-- disciple to rewatch the lesson before a retake unlocks, with a short
-- cooldown between attempts. Section F fix: three failed attempts
-- auto-notifies the Builder. Neither fits cleanly in a trigger — "is a
-- retake currently allowed" needs to reject the client's request with a
-- clear reason, which is what the record-test-attempt Edge Function
-- (this phase) does; this migration adds the columns it needs and locks
-- test-scoring fields behind it.

alter table public.module_progress
  add column rewatch_required boolean not null default false,
  add column rewatched_at timestamptz,
  add column cooldown_until timestamptz;

comment on column public.module_progress.rewatch_required is 'Set true on a failed attempt; cleared once the disciple confirms rewatch (rewatched_at set after the failure).';
comment on column public.module_progress.cooldown_until is 'A retake is blocked until this timestamp, even after rewatch is confirmed — prevents rapid re-guessing (Section C.2 fix).';

alter table public.module_progress
  add constraint module_progress_clock_out_after_clock_in
    check (clock_out_at is null or clock_in_at is null or clock_out_at >= clock_in_at);

-- Disciples keep direct write access to clock_in_at/clock_out_at (Phase 1
-- RLS, unchanged — clock-in/out is a simple client-driven action) and
-- rewatched_at (a self-report, same trust model as prayer_done elsewhere
-- in this schema — PRD Section C.3 explicitly rejects trying to verify
-- these actions, only to confirm they were reported). Grading/gating
-- fields must go through record-test-attempt's cooldown/rewatch/3-strikes
-- logic — a disciple directly PATCHing test_score would otherwise bypass
-- all of it.
create or replace function public.guard_module_progress_disciple_columns()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.test_score is distinct from old.test_score
    or new.attempts is distinct from old.attempts
    or new.status is distinct from old.status
    or new.rewatch_required is distinct from old.rewatch_required
    or new.cooldown_until is distinct from old.cooldown_until
  then
    raise exception
      'test_score/attempts/status/rewatch_required/cooldown_until can only be changed via the record-test-attempt Edge Function.';
  end if;

  return new;
end;
$$;

create trigger guard_module_progress_disciple_columns
  before update on public.module_progress
  for each row execute function public.guard_module_progress_disciple_columns();
