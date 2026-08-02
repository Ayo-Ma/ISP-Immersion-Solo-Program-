-- Phase 1: Backend Foundation — core tables.
-- Mirrors Backend System Design Section A exactly (15 physical tables,
-- documented there as 13 rows since two rows each bundle a pair:
-- "pathways / modules" and "growth_stages / disciple_growth_progress").
--
-- Section E guardrails applied throughout:
--   - UUID primary keys everywhere (gen_random_uuid(), no auto-increment
--     integers — avoids leaking growth-rate info through the ID itself).
--   - Soft-delete only: FKs use ON DELETE RESTRICT, never CASCADE, forcing
--     an explicit withdrawal flow instead of an accidental cascade wipe.
--   - created_at/updated_at on every table (chat_messages uses sent_at as
--     its single domain timestamp instead — see note on that table).
--
-- Explicitly OUT of scope here (Phase 2, per the MVP Dev Roadmap's Core
-- Domain Logic checklist, not Phase 1's Backend Foundation):
--   - State-machine transition enforcement (e.g. the CHECK/trigger
--     blocking graduation_requests.sm_at before builder_at is set).
--   - The 48-hour checklist escalation job, retake cooldown logic, Builder
--     capacity soft-cap check, and the Reassign Builder action itself.
-- This migration only builds the shape those Phase 2 behaviors will sit on.

create table public.users (
  id uuid primary key references auth.users (id) on delete restrict,
  role user_role not null,
  name text not null,
  email text not null unique,
  timezone text not null default 'UTC',
  status user_status not null default 'active',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.users is 'Every person: Lead Pastor, Supervising Minister, Builder, Disciple.';
comment on column public.users.last_synced_at is 'Powers the "Last synced" indicator (Section F1) — updated on every successful WatermelonDB pull/push.';

create table public.builder_disciple (
  id uuid primary key default gen_random_uuid(),
  builder_id uuid not null references public.users (id) on delete restrict,
  disciple_id uuid not null references public.users (id) on delete restrict,
  assigned_by uuid not null references public.users (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  status builder_disciple_status not null default 'active',
  ended_at timestamptz,
  reassignment_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.builder_disciple is 'The Builder<->Disciple pairing. This relationship, not a role field, is what RLS uses to decide what a Builder can see.';
comment on column public.builder_disciple.reassignment_reason is 'Section F2: a reassignment INSERTs a new row and sets status=ended on the old one — never UPDATEs builder_id in place, or the audit trail the Reassign action promises is destroyed.';

-- At most one active Builder per Disciple at a time — a structural
-- invariant, not a Phase 2 business rule.
create unique index builder_disciple_one_active_per_disciple
  on public.builder_disciple (disciple_id)
  where status = 'active';

create table public.approval_delegations (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,
  primary_user_id uuid not null references public.users (id) on delete restrict,
  delegate_user_id uuid not null references public.users (id) on delete restrict,
  active_from timestamptz not null default now(),
  active_until timestamptz,
  reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approval_delegations_role_must_be_delegatable
    check (role in ('lead_pastor', 'supervising_minister')),
  constraint approval_delegations_not_self check (primary_user_id <> delegate_user_id),
  constraint approval_delegations_valid_window
    check (active_until is null or active_until > active_from)
);
comment on table public.approval_delegations is 'Section F3: backs the 72-hour backup-approver fix. A property of a role''s availability, not of any single request — kept separate from pathway_requests/graduation_requests so the logic can''t drift out of sync between the two.';

create table public.pathways (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.pathways is 'The curriculum catalog set by leadership — not disciple-specific data.';

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  pathway_id uuid not null references public.pathways (id) on delete restrict,
  order_index integer not null,
  title text not null,
  video_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modules_pathway_order_unique unique (pathway_id, order_index)
);

create table public.pathway_requests (
  id uuid primary key default gen_random_uuid(),
  disciple_id uuid not null references public.users (id) on delete restrict,
  pathway_id uuid not null references public.pathways (id) on delete restrict,
  status pathway_request_status not null default 'requested',
  lp_approved_at timestamptz,
  sm_approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.pathway_requests is 'Registration approval flow (Section C.1). lp_approved_at and sm_approved_at are independent columns — both must be non-null to proceed (parallel, not sequential).';

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  disciple_id uuid not null references public.users (id) on delete restrict,
  pathway_id uuid not null references public.pathways (id) on delete restrict,
  status enrollment_status not null default 'active',
  started_at timestamptz not null default now(),
  graduated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PRD Section C.1 fix ("Structural Loophole"): a disciple may only be
-- enrolled in one active pathway at a time at MVP. This is the schema-level
-- guarantee of that already-locked-in decision, not a new business rule.
create unique index enrollments_one_active_per_disciple
  on public.enrollments (disciple_id)
  where status = 'active';

create table public.module_progress (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete restrict,
  module_id uuid not null references public.modules (id) on delete restrict,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  test_score numeric(5, 2),
  attempts integer not null default 0,
  status module_progress_status not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint module_progress_enrollment_module_unique unique (enrollment_id, module_id),
  constraint module_progress_attempts_non_negative check (attempts >= 0),
  constraint module_progress_test_score_range
    check (test_score is null or (test_score >= 0 and test_score <= 100))
);

create table public.daily_checklists (
  id uuid primary key default gen_random_uuid(),
  disciple_id uuid not null references public.users (id) on delete restrict,
  date date not null,
  class_done boolean not null default false,
  test_done boolean not null default false,
  prayer_done boolean not null default false,
  status checklist_status not null default 'draft',
  builder_reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_checklists_disciple_date_unique unique (disciple_id, date)
);
comment on table public.daily_checklists is 'One row per disciple per day (Section A) — the heart of the accountability loop.';

create table public.graduation_requests (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete restrict,
  status graduation_request_status not null default 'eligible',
  builder_at timestamptz,
  sm_at timestamptz,
  lp_at timestamptz,
  rejection_reason text,
  rejected_by uuid references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.graduation_requests is 'The 3-step chain (Section C.3). Sequential, unlike pathway_requests. Sequential enforcement is Phase 2 scope (MVP Dev Roadmap) — not built in this migration.';

-- Append-only: a chat message is never edited, so sent_at (already the
-- doc-specified field) covers what created_at/updated_at would — adding a
-- redundant updated_at for content that's never updated would be noise,
-- not rigor.
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  builder_id uuid not null references public.users (id) on delete restrict,
  disciple_id uuid not null references public.users (id) on delete restrict,
  sender_id uuid not null references public.users (id) on delete restrict,
  body text not null,
  sent_at timestamptz not null default now(),
  constraint chat_messages_sender_is_participant
    check (sender_id = builder_id or sender_id = disciple_id)
);
comment on table public.chat_messages is '1:1 chat, scoped to a single Builder-Disciple pair per row (Section A).';

create table public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  builder_id uuid not null references public.users (id) on delete restrict,
  disciple_id uuid not null references public.users (id) on delete restrict,
  scheduled_at timestamptz,
  meet_link text,
  status weekly_checkin_status not null default 'proposed',
  report text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete restrict,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  channel notification_channel not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.notifications is 'channel is realtime/digest — the column that makes the notification-flood fix enforceable (Section B).';
comment on column public.notifications.event_type is 'Deliberately text, not an enum: the full event taxonomy (Notification Matrix, PRD Section B) is finalized when Phase 8 wires up firing logic, not presumed here.';

create table public.growth_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  order_index integer not null unique,
  criteria text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.growth_stages.criteria is 'PRD Section C.14 fix: every stage must have explicit, visible advancement criteria — NOT NULL enforces that at creation time, not just in UI copy.';

create table public.disciple_growth_progress (
  id uuid primary key default gen_random_uuid(),
  disciple_id uuid not null unique references public.users (id) on delete restrict,
  current_stage_id uuid not null references public.growth_stages (id) on delete restrict,
  advanced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
