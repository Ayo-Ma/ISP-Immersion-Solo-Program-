-- Phase 2: Core Domain Logic — pathway_requests state machine.
-- Backend System Design Section C.1: requested -> under_review ->
-- approved (BOTH lp_approved_at and sm_approved_at, parallel, either
-- order) OR rejected (either approver, rejection_reason required).
--
-- status is derived, not client-settable: this trigger recomputes it from
-- the actual approval/rejection columns on every write, so whatever a
-- client sends for `status` itself is simply overwritten. That closes the
-- gap the Phase 1 guard triggers didn't: those stop an approver writing
-- the WRONG approval column, this stops anyone writing a status that
-- doesn't match the approval columns at all (e.g. "approved" with only
-- one signature).

create or replace function public.derive_pathway_request_status()
returns trigger
language plpgsql
as $$
begin
  if new.rejection_reason is not null then
    new.status := 'rejected';
  elsif new.lp_approved_at is not null and new.sm_approved_at is not null then
    new.status := 'approved';
  elsif new.lp_approved_at is not null or new.sm_approved_at is not null then
    new.status := 'under_review';
  else
    new.status := 'requested';
  end if;

  return new;
end;
$$;

create trigger derive_pathway_request_status
  before insert or update on public.pathway_requests
  for each row execute function public.derive_pathway_request_status();
