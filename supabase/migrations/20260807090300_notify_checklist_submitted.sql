-- Phase 8: Notifications — PRD Notification Matrix: "Disciple submits
-- daily checklist -> Builder (for approval, real-time)." AFTER UPDATE, not
-- BEFORE: normalize_checklist_status (Phase 2, a BEFORE trigger) already
-- rewrites 'submitted' to 'pending_review' by the time this trigger's
-- new.status is evaluated, so checking for 'pending_review' here sees the
-- normalized value, not the client's raw 'submitted' input.
create or replace function public.notify_checklist_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_builder_id uuid;
begin
  if new.status = 'pending_review' and old.status is distinct from 'pending_review' then
    select bd.builder_id into v_builder_id
    from public.builder_disciple bd
    where bd.disciple_id = new.disciple_id and bd.status = 'active';

    if v_builder_id is not null then
      insert into public.notifications (user_id, event_type, payload, channel)
      values (
        v_builder_id,
        'checklist_submitted',
        jsonb_build_object('checklist_id', new.id, 'disciple_id', new.disciple_id),
        'realtime'
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger notify_checklist_submitted
  after update on public.daily_checklists
  for each row execute function public.notify_checklist_submitted();
