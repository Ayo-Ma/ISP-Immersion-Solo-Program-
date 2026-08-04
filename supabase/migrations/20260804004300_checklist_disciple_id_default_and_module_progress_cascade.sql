-- Two more gaps found while verifying Phase 4 against real data (not by
-- inspection):
--
-- 1. daily_checklists.disciple_id had no way to get populated on a direct
--    client insert other than the caller remembering to pass it — and the
--    actual screen code (createTodayChecklist) didn't. RLS correctly
--    rejected the resulting NULL against auth.uid(), which is what
--    surfaced this. Same "derived, not client-trusted" pattern used
--    elsewhere in this schema: default it from the session, so a caller
--    can't get it wrong (and can't spoof it either — RLS's
--    disciple_id = auth.uid() check still applies regardless of whether
--    the value came from a default or an explicit column).
--
-- 2. Nothing ever created module_progress rows for a newly active
--    enrollment. A freshly-approved disciple's Dashboard would query
--    module_progress, get zero rows back, and show "all caught up" —
--    exactly backwards for someone who hasn't started anything. Same
--    cascade pattern as apply_pathway_approval_to_enrollment (this
--    phase) and apply_graduation_to_enrollment (Phase 2): one row per
--    module in the pathway, at enrollment time.

alter table public.daily_checklists
  alter column disciple_id set default auth.uid();

create or replace function public.create_module_progress_for_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.module_progress (enrollment_id, module_id)
  select new.id, m.id
  from public.modules m
  where m.pathway_id = new.pathway_id;

  return new;
end;
$$;

create trigger create_module_progress_for_enrollment
  after insert on public.enrollments
  for each row execute function public.create_module_progress_for_enrollment();
