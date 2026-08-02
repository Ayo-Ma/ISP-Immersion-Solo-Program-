-- Phase 2: Core Domain Logic — 48-hour unreviewed-checklist escalation.
-- Backend System Design Section C.2: "pending_review, unreviewed 48hrs ->
-- auto-escalation notification to Supervising Minister (does not change
-- the row's status — purely a notification side-effect)."
--
-- Notifies every Supervising Minister, not a specific one — the schema
-- has no SM-to-Builder/discipleship-unit mapping (PRD Section A: a single
-- Supervising Minister "oversees all Builders" at MVP scope), so there's
-- no narrower target to route to.
--
-- SECURITY DEFINER: notifications has no client INSERT policy at all
-- (Phase 1: "system-generated... never client-authored") — this function
-- IS that system.

create extension if not exists pg_cron;

create or replace function public.escalate_unreviewed_checklists()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, event_type, payload, channel)
  select sm.id,
         'checklist_unreviewed_48h',
         jsonb_build_object('checklist_id', dc.id, 'disciple_id', dc.disciple_id),
         'realtime'
  from public.daily_checklists dc
  cross join public.users sm
  where dc.status = 'pending_review'
    and dc.updated_at < now() - interval '48 hours'
    and sm.role = 'supervising_minister'
    and not exists (
      select 1
      from public.notifications n
      where n.event_type = 'checklist_unreviewed_48h'
        and n.user_id = sm.id
        and (n.payload ->> 'checklist_id') = dc.id::text
    );
end;
$$;

-- Hourly is frequent enough that a checklist won't sit unreviewed for
-- much longer than the 48-hour threshold before the escalation fires, and
-- infrequent enough not to be wasteful.
select cron.schedule(
  'escalate-unreviewed-checklists',
  '0 * * * *',
  $$select public.escalate_unreviewed_checklists();$$
);
