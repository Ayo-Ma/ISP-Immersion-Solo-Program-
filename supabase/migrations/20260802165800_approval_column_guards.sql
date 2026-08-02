-- Phase 1: Backend Foundation — approval column-ownership guards.
-- RLS (previous migration) grants row-level UPDATE eligibility to every
-- approver role on pathway_requests and graduation_requests, matching
-- Section B's "read all" scope. But RLS is row-level, not column-level —
-- it can't by itself stop a Supervising Minister from writing
-- lp_approved_at on a row they're otherwise allowed to touch. These
-- triggers close that specific gap: each approver may only ever move
-- their OWN approval timestamp, never impersonate another approver's.
--
-- Deliberately narrow: this does not validate status transitions or which
-- fields must move together on approval vs. rejection — that's the actual
-- state machine, explicitly Phase 2 scope (MVP Dev Roadmap). This is a
-- pure access-control guard (Section B concern), not workflow logic.

create or replace function public.guard_pathway_request_approval_columns()
returns trigger
language plpgsql
as $$
declare
  v_role user_role := public.current_user_role();
begin
  if v_role = 'supervising_minister' and new.lp_approved_at is distinct from old.lp_approved_at then
    raise exception
      'Supervising Minister cannot modify lp_approved_at — that is the Lead Pastor''s approval column.';
  end if;

  if v_role = 'lead_pastor' and new.sm_approved_at is distinct from old.sm_approved_at then
    raise exception
      'Lead Pastor cannot modify sm_approved_at — that is the Supervising Minister''s approval column.';
  end if;

  return new;
end;
$$;

create trigger guard_pathway_request_approval_columns
  before update on public.pathway_requests
  for each row execute function public.guard_pathway_request_approval_columns();

create or replace function public.guard_graduation_request_approval_columns()
returns trigger
language plpgsql
as $$
declare
  v_role user_role := public.current_user_role();
begin
  if v_role = 'builder'
    and (new.sm_at is distinct from old.sm_at or new.lp_at is distinct from old.lp_at)
  then
    raise exception
      'Builder cannot modify sm_at or lp_at — those belong to the Supervising Minister and Lead Pastor approval steps.';
  end if;

  if v_role = 'supervising_minister'
    and (new.builder_at is distinct from old.builder_at or new.lp_at is distinct from old.lp_at)
  then
    raise exception 'Supervising Minister cannot modify builder_at or lp_at.';
  end if;

  if v_role = 'lead_pastor'
    and (new.builder_at is distinct from old.builder_at or new.sm_at is distinct from old.sm_at)
  then
    raise exception 'Lead Pastor cannot modify builder_at or sm_at.';
  end if;

  return new;
end;
$$;

create trigger guard_graduation_request_approval_columns
  before update on public.graduation_requests
  for each row execute function public.guard_graduation_request_approval_columns();
