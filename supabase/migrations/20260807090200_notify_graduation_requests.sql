-- Phase 8: Notifications — graduation_requests events. PRD Notification
-- Matrix: "Graduation recommended (3-step chain) -> Next approver in
-- chain: Builder -> Supervising Minister -> Lead Pastor (real-time). Any
-- rejection requires a reason, routed to the prior approver -- not
-- directly to the disciple."
create or replace function public.notify_graduation_request_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_disciple_id uuid;
  v_builder_id uuid;
begin
  if new.status = 'builder_recommended' and old.status is distinct from 'builder_recommended' then
    insert into public.notifications (user_id, event_type, payload, channel)
    select u.id,
           'graduation_step_advanced',
           jsonb_build_object('graduation_request_id', new.id, 'status', new.status),
           'realtime'
    from public.users u
    where u.role = 'supervising_minister';

  elsif new.status = 'sm_reviewed' and old.status is distinct from 'sm_reviewed' then
    insert into public.notifications (user_id, event_type, payload, channel)
    select u.id,
           'graduation_step_advanced',
           jsonb_build_object('graduation_request_id', new.id, 'status', new.status),
           'realtime'
    from public.users u
    where u.role = 'lead_pastor';

  elsif new.status = 'rejected_by_sm' and old.status is distinct from 'rejected_by_sm' then
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

  elsif new.status = 'rejected_by_lp' and old.status is distinct from 'rejected_by_lp' then
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
  after update on public.graduation_requests
  for each row execute function public.notify_graduation_request_events();
