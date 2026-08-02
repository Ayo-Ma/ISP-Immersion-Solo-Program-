-- Phase 2 fix: rewatched_at must be a server timestamp, never a
-- client-supplied one. It's compared against failed_at (set server-side,
-- inside record-test-attempt) to gate retakes — if a disciple's device
-- clock is skewed from Postgres's, a client-supplied rewatched_at could
-- compare incorrectly against a server-supplied failed_at even when the
-- rewatch genuinely happened after the failure. Found by the Phase 2 test
-- suite itself (edge-functions.test.mjs), not by inspection.
--
-- Fix: whenever a non-service_role caller changes rewatched_at, silently
-- overwrite whatever value they sent with now() — same "derived, not
-- client-trusted" pattern as the status columns elsewhere in this schema.
-- The disciple still controls WHETHER it's set (their own RLS-scoped
-- write), just not WHAT VALUE it holds.

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

  if new.rewatched_at is distinct from old.rewatched_at then
    new.rewatched_at := now();
  end if;

  return new;
end;
$$;
