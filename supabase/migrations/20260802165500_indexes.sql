-- Phase 1: Backend Foundation — indexes (Backend System Design, Section D).
-- "Index every foreign key... these are the columns every dashboard query
-- filters on." Foreign keys are NOT auto-indexed by Postgres on the
-- referencing side, only the referenced primary key is — every FK below
-- that isn't already covered by a unique constraint's leading column gets
-- an explicit index. The two composite indexes and two status indexes
-- named directly in Section D are included as specified.

create index builder_disciple_builder_id_idx on public.builder_disciple (builder_id);
create index builder_disciple_disciple_id_idx on public.builder_disciple (disciple_id);
create index builder_disciple_assigned_by_idx on public.builder_disciple (assigned_by);

create index approval_delegations_primary_user_id_idx on public.approval_delegations (primary_user_id);
create index approval_delegations_delegate_user_id_idx on public.approval_delegations (delegate_user_id);

create index pathway_requests_disciple_id_idx on public.pathway_requests (disciple_id);
create index pathway_requests_pathway_id_idx on public.pathway_requests (pathway_id);

create index enrollments_disciple_id_idx on public.enrollments (disciple_id);
create index enrollments_pathway_id_idx on public.enrollments (pathway_id);

-- module_progress(enrollment_id) is already the leading column of the
-- enrollment_id/module_id unique constraint, so only module_id needs its
-- own index here.
create index module_progress_module_id_idx on public.module_progress (module_id);

-- daily_checklists(disciple_id, date) is already the Section D composite,
-- satisfied by the disciple_date unique constraint's index.
create index daily_checklists_status_idx on public.daily_checklists (status);

create index graduation_requests_enrollment_id_idx on public.graduation_requests (enrollment_id);
create index graduation_requests_status_idx on public.graduation_requests (status);

create index chat_messages_builder_id_idx on public.chat_messages (builder_id);
create index chat_messages_disciple_id_idx on public.chat_messages (disciple_id);
create index chat_messages_sender_id_idx on public.chat_messages (sender_id);

create index weekly_checkins_builder_id_idx on public.weekly_checkins (builder_id);
create index weekly_checkins_disciple_id_idx on public.weekly_checkins (disciple_id);

-- Section D composite: powers the notification badge/inbox for every role.
create index notifications_user_id_read_at_idx on public.notifications (user_id, read_at);

create index disciple_growth_progress_current_stage_id_idx
  on public.disciple_growth_progress (current_stage_id);
