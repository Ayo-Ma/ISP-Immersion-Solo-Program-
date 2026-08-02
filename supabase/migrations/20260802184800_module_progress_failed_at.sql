-- Phase 2: adds module_progress.failed_at, a precise anchor for "has the
-- disciple rewatched since the failure that required it." Using the
-- shared updated_at (bumped by ANY row touch, including a later
-- clock_in_at re-set) would make the rewatch-after-failure check stricter
-- than intended in an edge case; a dedicated timestamp set only at the
-- moment of failure avoids that ambiguity entirely.

alter table public.module_progress
  add column failed_at timestamptz;

comment on column public.module_progress.failed_at is 'Set by record-test-attempt on a failed attempt. A rewatch only satisfies the retake gate if rewatched_at > failed_at.';

-- Re-declare the guard (same trigger, replaced function body) to also
-- lock failed_at behind the Edge Function — it's grading state, not a
-- disciple self-report like rewatched_at.
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
    or new.failed_at is distinct from old.failed_at
  then
    raise exception
      'test_score/attempts/status/rewatch_required/cooldown_until/failed_at can only be changed via the record-test-attempt Edge Function.';
  end if;

  return new;
end;
$$;
