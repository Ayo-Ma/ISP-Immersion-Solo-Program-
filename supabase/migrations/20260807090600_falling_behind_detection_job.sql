-- Phase 8: Notifications — PRD Notification Matrix: "Disciple inactive 3+
-- days (NEW) -> Disciple (gentle reminder). Builder (real-time alert)."
-- Same shape as Phase 2's escalate_unreviewed_checklists: SECURITY
-- DEFINER, pg_cron-scheduled, "not exists a notification already sent
-- today" dedup so this doesn't re-fire every run while a disciple stays
-- inactive.
--
-- "Inactive" = an active enrollment with no daily_checklists row (any
-- status) in the last 3 days — the same definition Phase 6's
-- listAtRiskDisciples() dashboard read uses, now actually firing a
-- notification instead of only being visible on-demand.
create or replace function public.detect_falling_behind_disciples()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, event_type, payload, channel)
  select e.disciple_id,
         'disciple_inactive_3d',
         jsonb_build_object('disciple_id', e.disciple_id),
         'realtime'
  from public.enrollments e
  where e.status = 'active'
    and not exists (
      select 1 from public.daily_checklists dc
      where dc.disciple_id = e.disciple_id
        and dc.date >= current_date - 3
    )
    and not exists (
      select 1 from public.notifications n
      where n.event_type = 'disciple_inactive_3d'
        and n.user_id = e.disciple_id
        and n.created_at::date = current_date
    );

  insert into public.notifications (user_id, event_type, payload, channel)
  select bd.builder_id,
         'disciple_inactive_3d_alert',
         jsonb_build_object('disciple_id', e.disciple_id),
         'realtime'
  from public.enrollments e
  join public.builder_disciple bd on bd.disciple_id = e.disciple_id and bd.status = 'active'
  where e.status = 'active'
    and not exists (
      select 1 from public.daily_checklists dc
      where dc.disciple_id = e.disciple_id
        and dc.date >= current_date - 3
    )
    and not exists (
      select 1 from public.notifications n
      where n.event_type = 'disciple_inactive_3d_alert'
        and n.user_id = bd.builder_id
        and (n.payload ->> 'disciple_id') = e.disciple_id::text
        and n.created_at::date = current_date
    );
end;
$$;

-- Once daily is proportionate for a "3+ days inactive" signal — no need
-- for the escalation job's hourly cadence.
select cron.schedule(
  'detect-falling-behind-disciples',
  '0 8 * * *',
  $$select public.detect_falling_behind_disciples();$$
);
