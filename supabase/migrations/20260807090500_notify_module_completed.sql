-- Phase 8: Notifications — PRD Notification Matrix: "Disciple completes a
-- module -> Builder (real-time). Lead Pastor + Supervising Minister (daily
-- digest)." The first event in this phase that actually needs the digest
-- channel, not just realtime — Phase 6's DigestScreen already reads
-- notifications.channel='digest' directly, so this is what finally
-- populates it.
create or replace function public.notify_module_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_disciple_id uuid;
  v_builder_id uuid;
begin
  if new.status = 'passed' and old.status is distinct from 'passed' then
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
        'module_completed',
        jsonb_build_object('module_progress_id', new.id, 'disciple_id', v_disciple_id),
        'realtime'
      );
    end if;

    insert into public.notifications (user_id, event_type, payload, channel)
    select u.id,
           'module_completed',
           jsonb_build_object('module_progress_id', new.id, 'disciple_id', v_disciple_id),
           'digest'
    from public.users u
    where u.role in ('lead_pastor', 'supervising_minister');
  end if;

  return new;
end;
$$;

create trigger notify_module_completed
  after update on public.module_progress
  for each row execute function public.notify_module_completed();
