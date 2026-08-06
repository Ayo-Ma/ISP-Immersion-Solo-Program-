-- Phase 8 fix: notify_graduation_request_events only fired on UPDATE, but
-- builder_at can be set at INSERT time (a Builder recommending graduation
-- via a single insert with builder_at already populated, not a separate
-- update afterward) — DiscipleDetailScreen's recommendGraduation() always
-- updates an existing eligible row, but nothing stops an insert from
-- arriving pre-recommended, and the Phase 8 integration test's own fixture
-- setup does exactly that. Found by the test, not by re-reading the SQL.
--
-- OLD doesn't exist on INSERT, so old_status is computed as NULL in that
-- case — 'is distinct from' already treats NULL correctly (NULL is
-- distinct from any non-null value is true), so no other branch logic
-- needs to change.
drop trigger if exists notify_graduation_request_events on public.graduation_requests;

create or replace function public.notify_graduation_request_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_disciple_id uuid;
  v_builder_id uuid;
  v_old_status public.graduation_request_status;
begin
  v_old_status := case when TG_OP = 'INSERT' then null else old.status end;

  if new.status = 'builder_recommended' and v_old_status is distinct from 'builder_recommended' then
    insert into public.notifications (user_id, event_type, payload, channel)
    select u.id,
           'graduation_step_advanced',
           jsonb_build_object('graduation_request_id', new.id, 'status', new.status),
           'realtime'
    from public.users u
    where u.role = 'supervising_minister';

  elsif new.status = 'sm_reviewed' and v_old_status is distinct from 'sm_reviewed' then
    insert into public.notifications (user_id, event_type, payload, channel)
    select u.id,
           'graduation_step_advanced',
           jsonb_build_object('graduation_request_id', new.id, 'status', new.status),
           'realtime'
    from public.users u
    where u.role = 'lead_pastor';

  elsif new.status = 'rejected_by_sm' and v_old_status is distinct from 'rejected_by_sm' then
    select e.disciple_id into v_disciple_id
    from public.enrollments e
    where e.id = new.enrollment_id;

    select bd.builder_id into v_builder_id
    from public.builder_disciple bd
    where bd.disciple_id = v_disciple_id and bd.status = 'active';

    if v_builder_id is not null then
      insert into public.notifications (user_id, event_type, payload, channel)
      values (
        v_builder_id,
        'graduation_request_rejected',
        jsonb_build_object(
          'graduation_request_id', new.id,
          'rejection_reason', new.rejection_reason
        ),
        'realtime'
      );
    end if;

  elsif new.status = 'rejected_by_lp' and v_old_status is distinct from 'rejected_by_lp' then
    insert into public.notifications (user_id, event_type, payload, channel)
    select u.id,
           'graduation_request_rejected',
           jsonb_build_object(
             'graduation_request_id', new.id,
             'rejection_reason', new.rejection_reason
           ),
           'realtime'
    from public.users u
    where u.role = 'supervising_minister';
  end if;

  return new;
end;
$$;

create trigger notify_graduation_request_events
  after insert or update on public.graduation_requests
  for each row execute function public.notify_graduation_request_events();
