-- Phase 1: Backend Foundation — enum types.
-- Backend System Design, Section A: "Every status/role field above should be
-- a database enum or CHECK constraint, never free-text." This migration
-- defines every fixed-vocabulary field as a Postgres enum so an invalid
-- value is a hard error, not a silent typo.

-- The four roles confirmed active at MVP (PRD Section A). A fifth role,
-- Content/Curriculum Admin, is a recommended-but-unconfirmed open item
-- (PRD Section E) and is deliberately excluded until locked in.
create type user_role as enum (
  'lead_pastor',
  'supervising_minister',
  'builder',
  'disciple'
);

-- Soft-delete lifecycle only (Backend System Design, Section E) — a user
-- row is never hard-deleted.
create type user_status as enum (
  'active',
  'inactive',
  'withdrawn'
);

-- builder_disciple pairing lifecycle. A reassignment never mutates an
-- existing row (Section F2) — it ends the old row and inserts a new one.
create type builder_disciple_status as enum (
  'active',
  'ended'
);

-- Registration approval flow (Section C.1). Parallel: both lp_approved_at
-- and sm_approved_at must be set, in either order.
create type pathway_request_status as enum (
  'requested',
  'under_review',
  'approved',
  'rejected'
);

-- Enrollment lifecycle (Section A: enrollments table).
create type enrollment_status as enum (
  'active',
  'graduated',
  'withdrawn'
);

-- Per-module progress, including retake attempts (Section C.2 fix: capped +
-- cooldown enforced server-side in Phase 2 — this is just the state shape).
create type module_progress_status as enum (
  'not_started',
  'in_progress',
  'passed',
  'failed'
);

-- Daily checklist flow (Section C.2): draft -> submitted -> pending_review
-- -> approved/needs_redo.
create type checklist_status as enum (
  'draft',
  'submitted',
  'pending_review',
  'approved',
  'needs_redo'
);

-- Graduation's 3-step chain (Section C.3): Builder -> Supervising Minister
-- -> Lead Pastor, sequential. Sequential enforcement (a CHECK/trigger
-- blocking sm_at before builder_at) is explicitly Phase 2 scope (MVP Dev
-- Roadmap, Phase 2 checklist) — this enum just names the valid states.
create type graduation_request_status as enum (
  'eligible',
  'builder_recommended',
  'sm_reviewed',
  'rejected_by_sm',
  'lp_approved',
  'graduated',
  'rejected_by_lp'
);

-- Weekly check-in scheduling/report status (Section A: weekly_checkins).
create type weekly_checkin_status as enum (
  'proposed',
  'scheduled',
  'completed',
  'cancelled'
);

-- notifications.channel: the column that makes the notification-flood fix
-- (PRD Non-Functional Requirements) enforceable — real-time vs. digest.
create type notification_channel as enum (
  'realtime',
  'digest'
);
