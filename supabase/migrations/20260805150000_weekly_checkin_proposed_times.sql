-- Phase 5: Builder Experience — weekly check-in "propose 3 times" flow.
-- PRD Section C.8 fix: "lightweight 'propose 3 times, disciple picks one'
-- flow" to cut back-and-forth scheduling messages. The Phase 1 schema only
-- had a single scheduled_at column, which can't represent three candidate
-- times before one is picked. Kept as a plain array on the same row rather
-- than a child table — Backend System Design explicitly frames this as a
-- lightweight flow, not something that needs its own normalized table, and
-- there's exactly one proposer (the assigned Builder) so there's no
-- multi-writer conflict a child table would exist to resolve.
alter table public.weekly_checkins
  add column proposed_times timestamptz[];

comment on column public.weekly_checkins.proposed_times is
  'Up to 3 candidate times the Builder proposes (status=proposed). scheduled_at is set to whichever one the disciple picks, via the select-checkin-time Edge Function, which also flips status to scheduled.';
