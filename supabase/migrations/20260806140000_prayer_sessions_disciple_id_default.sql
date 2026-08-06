-- Phase 7 fix: prayer_sessions.disciple_id was never defaulted, the same
-- gap Phase 4 hit and fixed on daily_checklists.disciple_id — the
-- disciple-facing insert (apps/mobile/lib/queries/disciple.ts's
-- startPrayerSession, clocking in from Chat) never sets it explicitly,
-- relying on RLS's own disciple_id = auth.uid() check, which fails outright
-- when the column is simply null. Found by the Phase 7 integration test
-- against real infra, not by code review.
alter table public.prayer_sessions
  alter column disciple_id set default auth.uid();
