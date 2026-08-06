-- Phase 8: Notifications — pathway_requests events from the PRD
-- Notification Matrix: "Pathway requested at registration -> Lead Pastor,
-- Supervising Minister (for approval, real-time)" and the rejection half
-- of "Builder approves/rejects daily checklist -> Disciple (rejection
-- must include a reason)" generalized to every approval flow in this
-- schema, not just checklists.
--
-- SECURITY DEFINER, same reasoning as escalate_unreviewed_checklists:
-- notifications has no client INSERT policy at all.
create or replace function public.notify_pathway_request_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.notifications (user_id, event_type, payload, channel)
    select u.id,
           'pathway_request_created',
           jsonb_build_object('pathway_request_id', new.id, 'disciple_id', new.disciple_id),
           'realtime'
    from public.users u
    where u.role in ('lead_pastor', 'supervising_minister');

  elsif TG_OP = 'UPDATE'
    and new.status = 'rejected'
    and old.status is distinct from 'rejected'
  then
    insert into public.notifications (user_id, event_type, payload, channel)
    values (
      new.disciple_id,
      'pathway_request_rejected',
      jsonb_build_object(
        'pathway_request_id', new.id,
        'rejection_reason', new.rejection_reason
      ),
      'realtime'
    );
  end if;

  return new;
end;
$$;

create trigger notify_pathway_request_events
  after insert or update on public.pathway_requests
  for each row execute function public.notify_pathway_request_events();
