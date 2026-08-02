-- Phase 1: Backend Foundation — triggers.
-- 1. Generic updated_at maintenance (Section E: "Timestamp everything").
-- 2. Role assignment on signup (MVP Dev Roadmap, Phase 1 checklist:
--    "Build role assignment mechanism — how a users.role gets set on
--    signup (admin-invited, not self-selected, since roles carry real
--    authority)").

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.users
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.builder_disciple
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.approval_delegations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.pathways
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.modules
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.pathway_requests
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.enrollments
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.module_progress
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.daily_checklists
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.graduation_requests
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.weekly_checkins
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.growth_stages
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.disciple_growth_progress
  for each row execute function public.set_updated_at();

-- public.users.id mirrors auth.users.id 1:1. A brand-new auth user MUST
-- carry a role in its invite metadata — there is no self-service path that
-- reaches this trigger with a role already chosen by the signee, since
-- role assignment only happens via supabase.auth.admin.inviteUserByEmail
-- (service_role only, called from a trusted server context — Phase 2/6
-- admin tooling), never from client-exposed sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := new.raw_user_meta_data ->> 'role';
  v_name text := coalesce(new.raw_user_meta_data ->> 'name', new.email);
begin
  if v_role is null then
    raise exception
      'auth user % has no role in invite metadata — roles are admin-invited, never self-selected. Invite via supabase.auth.admin.inviteUserByEmail with data: { role, name }.',
      new.id;
  end if;

  insert into public.users (id, role, name, email)
  values (new.id, v_role::user_role, v_name, new.email);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
