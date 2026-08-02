-- Phase 1: Backend Foundation — Row-Level Security (Standing Risk #1: RLS
-- must be tested automatically as each table ships, not deferred to
-- end-of-project QA). Policies below implement Backend System Design
-- Section B's matrix exactly where the doc specifies one.
--
-- Eight tables aren't in Section B's matrix at all (builder_disciple,
-- pathways, modules, enrollments, module_progress, weekly_checkins,
-- growth_stages, disciple_growth_progress). For those, this migration
-- applies the same visibility pattern the documented tables establish
-- (Disciple: own rows; Builder: assigned disciples' rows via
-- builder_disciple; Supervising Minister/Lead Pastor: all rows) rather
-- than leaving them undocumented-and-unprotected. Flagged here, not
-- silently assumed — worth a look from whoever owns the Backend System
-- Design doc.
--
-- One deliberate correction to the doc's literal wording: Section B's
-- pathway_requests row lists the Supervising Minister as writing
-- "lp_approved_at/sm_approved_at" (both fields). Section C describes these
-- as independent, single-owner columns, and PRD Section F's whole point on
-- this flow is two genuinely separate approvers. Implemented here as SM
-- writes sm_approved_at only, LP writes lp_approved_at only — the doc's
-- wording looks like a copy/paste slip, not an intended shared-write design.
-- Row-level policies below grant both roles UPDATE eligibility on the row
-- (matching "read all"); the column-level split (who may touch which
-- specific column) is enforced by the guard trigger in the next migration,
-- since plain RLS can't express "this role may write column A but not
-- column B in the same row."

-- security definer + fixed search_path: without this, evaluating these
-- functions from inside a policy on public.users would re-trigger RLS on
-- public.users itself (infinite recursion). Running as the function owner
-- sidesteps that, which is the standard Supabase pattern for auth helpers.
create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.is_builder_of(p_disciple_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.builder_disciple
    where builder_id = auth.uid()
      and disciple_id = p_disciple_id
      and status = 'active'
  );
$$;

-- ============================================================ users =====
alter table public.users enable row level security;

create policy users_select on public.users
for select
using (
  id = auth.uid()
  or public.is_builder_of(id)
  or public.current_user_role() in ('supervising_minister', 'lead_pastor')
);
-- No insert/update/delete policy: rows are created only by the
-- handle_new_user trigger (security definer, bypasses RLS). Role/status
-- changes are an admin action, not a self-service one — deliberately no
-- write path for authenticated/anon roles here in Phase 1.

-- ================================================== builder_disciple ====
alter table public.builder_disciple enable row level security;

create policy builder_disciple_select on public.builder_disciple
for select
using (
  disciple_id = auth.uid()
  or builder_id = auth.uid()
  or public.current_user_role() in ('supervising_minister', 'lead_pastor')
);
-- No write policy: assignment/reassignment is a Phase 2/6 admin action via
-- service_role, not a direct client write.

-- ============================================== approval_delegations ====
alter table public.approval_delegations enable row level security;

create policy approval_delegations_select on public.approval_delegations
for select
using (
  (public.current_user_role() = 'supervising_minister' and primary_user_id = auth.uid())
  or public.current_user_role() = 'lead_pastor'
);

create policy approval_delegations_insert on public.approval_delegations
for insert
with check (
  primary_user_id = auth.uid()
  and public.current_user_role() in ('supervising_minister', 'lead_pastor')
);

create policy approval_delegations_update on public.approval_delegations
for update
using (
  primary_user_id = auth.uid()
  and public.current_user_role() in ('supervising_minister', 'lead_pastor')
)
with check (
  primary_user_id = auth.uid()
  and public.current_user_role() in ('supervising_minister', 'lead_pastor')
);

-- ============================================================ pathways ==
alter table public.pathways enable row level security;

create policy pathways_select on public.pathways
for select
using (auth.uid() is not null);
-- Catalog data, not disciple-specific (Section A) — every authenticated
-- role can read it. No client writes: content is managed by whoever ends
-- up owning Content/Curriculum Admin (PRD Section A — still an
-- unconfirmed role) via service_role tooling, not built here.

-- ============================================================= modules ==
alter table public.modules enable row level security;

create policy modules_select on public.modules
for select
using (auth.uid() is not null);

-- =================================================== pathway_requests ===
alter table public.pathway_requests enable row level security;

create policy pathway_requests_select on public.pathway_requests
for select
using (
  disciple_id = auth.uid()
  or public.is_builder_of(disciple_id)
  or public.current_user_role() in ('supervising_minister', 'lead_pastor')
);
-- No Disciple insert policy: Section B lists Disciple as "read only" on
-- this table. Creation happens via a Phase 2 Edge Function alongside the
-- pathway-suggestion logic, not a raw client insert.

create policy pathway_requests_update_sm_lp on public.pathway_requests
for update
using (public.current_user_role() in ('supervising_minister', 'lead_pastor'))
with check (public.current_user_role() in ('supervising_minister', 'lead_pastor'));

-- ========================================================= enrollments ==
alter table public.enrollments enable row level security;

create policy enrollments_select on public.enrollments
for select
using (
  disciple_id = auth.uid()
  or public.is_builder_of(disciple_id)
  or public.current_user_role() in ('supervising_minister', 'lead_pastor')
);
-- No client writes: enrollments are created by the Phase 2 approval logic
-- once a pathway_request is approved, not by direct client insert.

-- ===================================================== module_progress ==
alter table public.module_progress enable row level security;

create policy module_progress_select on public.module_progress
for select
using (
  exists (
    select 1
    from public.enrollments e
    where e.id = module_progress.enrollment_id
      and (
        e.disciple_id = auth.uid()
        or public.is_builder_of(e.disciple_id)
        or public.current_user_role() in ('supervising_minister', 'lead_pastor')
      )
  )
);

-- Clock-in/out and test attempts are disciple-driven (Section C.2), unlike
-- most other write flows in this schema.
create policy module_progress_insert_disciple on public.module_progress
for insert
with check (
  exists (
    select 1
    from public.enrollments e
    where e.id = module_progress.enrollment_id
      and e.disciple_id = auth.uid()
  )
);

create policy module_progress_update_disciple on public.module_progress
for update
using (
  exists (
    select 1
    from public.enrollments e
    where e.id = module_progress.enrollment_id
      and e.disciple_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.enrollments e
    where e.id = module_progress.enrollment_id
      and e.disciple_id = auth.uid()
  )
);

-- ===================================================== daily_checklists =
alter table public.daily_checklists enable row level security;

create policy daily_checklists_select on public.daily_checklists
for select
using (
  disciple_id = auth.uid()
  or public.is_builder_of(disciple_id)
  or public.current_user_role() in ('supervising_minister', 'lead_pastor')
);
-- SM's "write only on 48hr escalation" (Section B) is a scheduled-job
-- action (Phase 2 pg_cron/Edge Function using service_role), not a
-- direct user-driven write — no SM update policy here.

create policy daily_checklists_insert_disciple on public.daily_checklists
for insert
with check (disciple_id = auth.uid());

create policy daily_checklists_update_disciple on public.daily_checklists
for update
using (disciple_id = auth.uid() and status = 'draft')
with check (disciple_id = auth.uid());

create policy daily_checklists_update_builder on public.daily_checklists
for update
using (public.is_builder_of(disciple_id))
with check (public.is_builder_of(disciple_id));

-- ================================================== graduation_requests =
alter table public.graduation_requests enable row level security;

create policy graduation_requests_select on public.graduation_requests
for select
using (
  exists (
    select 1
    from public.enrollments e
    where e.id = graduation_requests.enrollment_id
      and (e.disciple_id = auth.uid() or public.is_builder_of(e.disciple_id))
  )
  or public.current_user_role() in ('supervising_minister', 'lead_pastor')
);

create policy graduation_requests_update_builder on public.graduation_requests
for update
using (
  exists (
    select 1
    from public.enrollments e
    where e.id = graduation_requests.enrollment_id
      and public.is_builder_of(e.disciple_id)
  )
)
with check (
  exists (
    select 1
    from public.enrollments e
    where e.id = graduation_requests.enrollment_id
      and public.is_builder_of(e.disciple_id)
  )
);

create policy graduation_requests_update_sm_lp on public.graduation_requests
for update
using (public.current_user_role() in ('supervising_minister', 'lead_pastor'))
with check (public.current_user_role() in ('supervising_minister', 'lead_pastor'));

-- ======================================================= chat_messages =
alter table public.chat_messages enable row level security;

create policy chat_messages_select on public.chat_messages
for select
using (disciple_id = auth.uid() or builder_id = auth.uid());

create policy chat_messages_insert on public.chat_messages
for insert
with check (
  sender_id = auth.uid()
  and (disciple_id = auth.uid() or builder_id = auth.uid())
);
-- No update/delete: messages are immutable once sent.

-- ====================================================== weekly_checkins =
alter table public.weekly_checkins enable row level security;

create policy weekly_checkins_select on public.weekly_checkins
for select
using (
  disciple_id = auth.uid()
  or builder_id = auth.uid()
  or public.current_user_role() in ('supervising_minister', 'lead_pastor')
);

create policy weekly_checkins_insert on public.weekly_checkins
for insert
with check (builder_id = auth.uid());

create policy weekly_checkins_update on public.weekly_checkins
for update
using (builder_id = auth.uid())
with check (builder_id = auth.uid());

-- ========================================================= notifications
alter table public.notifications enable row level security;

create policy notifications_select on public.notifications
for select
using (user_id = auth.uid());

create policy notifications_update on public.notifications
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());
-- No insert policy: notifications are system-generated (Phase 2/8
-- triggers/Edge Functions via service_role), never client-authored.

-- ======================================================= growth_stages =
alter table public.growth_stages enable row level security;

create policy growth_stages_select on public.growth_stages
for select
using (auth.uid() is not null);

-- ============================================ disciple_growth_progress ==
alter table public.disciple_growth_progress enable row level security;

create policy disciple_growth_progress_select on public.disciple_growth_progress
for select
using (
  disciple_id = auth.uid()
  or public.is_builder_of(disciple_id)
  or public.current_user_role() in ('supervising_minister', 'lead_pastor')
);
-- No client writes: stage advancement is a Phase 2 business action.
