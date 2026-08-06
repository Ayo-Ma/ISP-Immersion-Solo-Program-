-- Phase 8: Notifications — PRD Notification Matrix: "Weekly check-in
-- scheduled/completed -> Disciple, Builder." Covers both the
-- select-checkin-time Edge Function's write (status -> scheduled) and the
-- Builder's direct RLS write submitting a report (status -> completed).
create or replace function public.notify_weekly_checkin_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'scheduled' and old.status is distinct from 'scheduled' then
    insert into public.notifications (user_id, event_type, payload, channel)
    values
      (
        new.disciple_id,
        'weekly_checkin_scheduled',
        jsonb_build_object('weekly_checkin_id', new.id, 'scheduled_at', new.scheduled_at),
        'realtime'
      ),
      (
        new.builder_id,
        'weekly_checkin_scheduled',
        jsonb_build_object('weekly_checkin_id', new.id, 'scheduled_at', new.scheduled_at),
        'realtime'
      );

  elsif new.status = 'completed' and old.status is distinct from 'completed' then
    insert into public.notifications (user_id, event_type, payload, channel)
    values
      (
        new.disciple_id,
        'weekly_checkin_completed',
        jsonb_build_object('weekly_checkin_id', new.id),
        'realtime'
      ),
      (
        new.builder_id,
        'weekly_checkin_completed',
        jsonb_build_object('weekly_checkin_id', new.id),
        'realtime'
      );
  end if;

  return new;
end;
$$;

create trigger notify_weekly_checkin_events
  after update on public.weekly_checkins
  for each row execute function public.notify_weekly_checkin_events();
