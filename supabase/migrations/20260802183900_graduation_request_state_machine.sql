-- Phase 2: Core Domain Logic — graduation_requests state machine.
-- Backend System Design Section C.3: eligible -> builder_recommended
-- (builder_at) -> sm_reviewed (sm_at) OR rejected_by_sm -> lp_approved
-- (lp_at) -> graduated OR rejected_by_lp. Sequential, unlike
-- pathway_requests — this is the exact CHECK constraint named in the MVP
-- Dev Roadmap's Phase 2 checklist, deferred from Phase 1 on purpose.

alter table public.graduation_requests
  add constraint graduation_requests_sm_requires_builder
    check (sm_at is null or builder_at is not null);

alter table public.graduation_requests
  add constraint graduation_requests_lp_requires_sm
    check (lp_at is null or sm_at is not null);

-- status is derived from builder_at/sm_at/lp_at/rejection_reason, same
-- reasoning as pathway_requests' trigger: a client-supplied status is
-- simply overwritten with what the columns actually say.
--
-- "lp_approved" (a valid enum value, Section C.3) is never actually
-- persisted here — the instant lp_at is set with no rejection, the
-- graduation IS final, and the cascading trigger below advances the
-- enrollment in the same operation. There's no distinct actor or step
-- between "LP approved" and "graduated" the way there genuinely is
-- between, say, "requested" and "under_review" on pathway_requests, so
-- persisting an intermediate state here would describe a moment nothing
-- is ever waiting on.
--
-- rejected_by is derived too: at most one of builder/sm/lp is the pending
-- approver at any point, so a fresh rejection can only have come from
-- whichever stage was pending — not trusted from client input.
create or replace function public.derive_graduation_request_status()
returns trigger
language plpgsql
as $$
begin
  if new.rejection_reason is not null then
    if old.rejection_reason is null then
      new.rejected_by := auth.uid();
    end if;

    if new.sm_at is null then
      new.status := 'rejected_by_sm';
    else
      new.status := 'rejected_by_lp';
    end if;
  elsif new.lp_at is not null then
    new.status := 'graduated';
  elsif new.sm_at is not null then
    new.status := 'sm_reviewed';
  elsif new.builder_at is not null then
    new.status := 'builder_recommended';
  else
    new.status := 'eligible';
  end if;

  return new;
end;
$$;

create trigger derive_graduation_request_status
  before insert or update on public.graduation_requests
  for each row execute function public.derive_graduation_request_status();

-- Cascades a completed graduation into the enrollment record. SECURITY
-- DEFINER because enrollments has no client UPDATE policy at all (Phase 1:
-- "created by the Phase 2 approval logic," not directly writable) — this
-- trigger IS that approval logic's completion step.
create or replace function public.apply_graduation_to_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'graduated' and old.status is distinct from 'graduated' then
    update public.enrollments
    set status = 'graduated',
        graduated_at = now()
    where id = new.enrollment_id;
  end if;

  return new;
end;
$$;

create trigger apply_graduation_to_enrollment
  after update on public.graduation_requests
  for each row execute function public.apply_graduation_to_enrollment();
