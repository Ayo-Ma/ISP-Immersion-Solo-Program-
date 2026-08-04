-- Gap found while building Phase 4 (Disciple Experience): Phase 2 built the
-- pathway_requests state machine (status derivation) but nothing ever
-- created the enrollments row "approved" is supposed to result in.
-- Backend System Design Section C.1 is explicit that approved means
-- "disciple unlocked" — that unlock has to actually happen somewhere, and
-- until now nothing did it. Same cascade pattern as
-- apply_graduation_to_enrollment (Phase 2, graduation_requests ->
-- enrollments), applied to the other end of the pathway lifecycle.
--
-- Idempotent against the one-active-enrollment-per-disciple partial unique
-- index (Phase 1): if a disciple somehow already has an active enrollment
-- when a second pathway_request is approved, this will fail loudly with a
-- constraint violation rather than silently creating a conflicting one —
-- correct, since Section C.1 restricts a disciple to one active pathway.

create or replace function public.apply_pathway_approval_to_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.enrollments (disciple_id, pathway_id)
    values (new.disciple_id, new.pathway_id);
  end if;

  return new;
end;
$$;

create trigger apply_pathway_approval_to_enrollment
  after update on public.pathway_requests
  for each row execute function public.apply_pathway_approval_to_enrollment();
