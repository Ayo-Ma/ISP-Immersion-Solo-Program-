-- Phase 2: Core Domain Logic — daily_checklists state machine.
-- Backend System Design Section C.2:
--   draft -> submitted (disciple action) -> pending_review
--   pending_review -> approved (Builder action)
--   pending_review -> needs_redo (Builder action, rejection_reason
--     required) -> draft (next day's entry blocked until resolved)
--
-- "submitted" and "needs_redo" are both real, PRD-visible states (Section
-- C.3 fix: "Submitted -> Pending Review -> Approved / Needs Redo" is
-- exactly what the disciple sees) but neither is ever the row's resting
-- state for more than an instant — the doc's own arrows show submitted
-- immediately becoming pending_review, and needs_redo immediately
-- becoming draft again so the disciple can redo it. This trigger performs
-- both of those immediate follow-on transitions, and separately enforces
-- that needs_redo can never be set without a rejection_reason (Section
-- C.3's "mandatory reason on every rejection" fix).

create or replace function public.normalize_checklist_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'needs_redo' and new.rejection_reason is null then
    raise exception 'daily_checklists.status cannot become needs_redo without a rejection_reason (PRD Section C.3).';
  end if;

  if new.status = 'submitted' then
    new.status := 'pending_review';
  elsif new.status = 'needs_redo' then
    new.status := 'draft';
  end if;

  return new;
end;
$$;

create trigger normalize_checklist_status
  before insert or update on public.daily_checklists
  for each row execute function public.normalize_checklist_status();
