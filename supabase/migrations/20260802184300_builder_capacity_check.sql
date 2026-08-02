-- Phase 2: Core Domain Logic — Builder capacity soft-cap check.
-- PRD Section C.4b / F: "recommend a soft cap of 8-12 disciples per
-- Builder. The admin assignment screen warns (does not block) when a
-- Builder exceeds it." Interpreted as: warn once a Builder would carry
-- MORE than 12 (the top of the recommended 8-12 range), not at 8 — 8-12
-- is the acceptable range itself, not a threshold to warn at the start of.
--
-- Deliberately a plain query function, not an enforcement trigger: a soft
-- cap that "warns, does not block" has to be surfaceable to a caller
-- (the reassign-builder Edge Function) as information, not something the
-- database silently rejects.

create or replace function public.builder_active_disciple_count(p_builder_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.builder_disciple
  where builder_id = p_builder_id
    and status = 'active';
$$;

create or replace function public.builder_exceeds_capacity_soft_cap(p_builder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.builder_active_disciple_count(p_builder_id) > 12;
$$;
