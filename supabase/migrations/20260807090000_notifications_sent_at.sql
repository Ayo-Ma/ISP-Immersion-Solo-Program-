-- Phase 8: Notifications — track OneSignal dispatch separately from
-- in-app read state. read_at is "the user opened/saw this in the app";
-- sent_at is "a push was actually dispatched for this row" — the two are
-- independent (a realtime push can be sent before the user ever opens the
-- app, and a digest row may never get an individual push at all). Nullable
-- and unused until dispatch-push-notifications is wired to real OneSignal
-- credentials (Phase 8: OneSignal integration explicitly deferred until
-- the project has a real App ID + REST API key).
alter table public.notifications
  add column sent_at timestamptz;
