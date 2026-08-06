-- Phase 7: Chat & Prayer Regimen — lock daily_checklists.prayer_done to
-- the clock-out-prayer Edge Function, same reasoning and same mechanism as
-- guard_module_progress_disciple_columns (Phase 2): class_done/test_done
-- stay simple disciple self-reports (Phase 1 RLS, unchanged), but
-- prayer_done is no longer a raw checkbox — it's set only when a real
-- prayer_sessions clock-out completes (PRD Section E: a self-report alone
-- isn't a genuine enough signal). A direct client PATCH would otherwise
-- let a disciple check the box without ever using the clock-in/out flow,
-- defeating the entire point of this phase.
create or replace function public.guard_daily_checklists_prayer_done()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.prayer_done is distinct from old.prayer_done then
    raise exception
      'prayer_done can only be set via the clock-out-prayer Edge Function.';
  end if;

  return new;
end;
$$;

create trigger guard_daily_checklists_prayer_done
  before update on public.daily_checklists
  for each row execute function public.guard_daily_checklists_prayer_done();
