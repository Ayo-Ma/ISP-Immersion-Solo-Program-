import type { GraduationRequestStatus, WeeklyCheckinStatus } from '@isp-app/shared-types';

import { supabase } from '../supabase';

/**
 * Phase 5 data layer — every query here runs as the authenticated Builder
 * and relies on the Phase 1 RLS policies (is_builder_of(disciple_id)) to
 * scope rows to assigned disciples only. No client-side filtering by
 * builder id is needed or trusted.
 */

export interface AssignedDisciple {
  id: string;
  name: string;
  email: string;
}

export interface ChecklistForReview {
  id: string;
  disciple_id: string;
  date: string;
  class_done: boolean;
  test_done: boolean;
  prayer_done: boolean;
  users: { name: string };
}

export interface EligibleGraduationRequest {
  id: string;
  enrollment_id: string;
  status: GraduationRequestStatus;
  builder_at: string | null;
  enrollments: { disciple_id: string; users: { name: string }; pathways: { name: string } };
}

export interface WeeklyCheckinRow {
  id: string;
  disciple_id: string;
  scheduled_at: string | null;
  meet_link: string | null;
  status: WeeklyCheckinStatus;
  proposed_times: string[] | null;
  report: string | null;
}

/** builder_disciple has three FKs to users (builder/disciple/assigned_by) — resolved as two plain
 * queries rather than an embedded select, to avoid relying on PostgREST's FK-disambiguation hint. */
export async function listAssignedDisciples(): Promise<AssignedDisciple[]> {
  const { data: pairings, error: pairingsError } = await supabase
    .from('builder_disciple')
    .select('disciple_id')
    .eq('status', 'active');
  if (pairingsError) throw pairingsError;
  if (pairings.length === 0) return [];

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, email')
    .in(
      'id',
      pairings.map((p) => p.disciple_id),
    );
  if (usersError) throw usersError;
  return users;
}

export async function listPendingReviewChecklists(): Promise<ChecklistForReview[]> {
  const { data, error } = await supabase
    .from('daily_checklists')
    .select('id, disciple_id, date, class_done, test_done, prayer_done, users(name)')
    .eq('status', 'pending_review')
    .order('date', { ascending: true });
  if (error) throw error;
  return data as unknown as ChecklistForReview[];
}

export async function listEligibleGraduationRequests(): Promise<EligibleGraduationRequest[]> {
  const { data, error } = await supabase
    .from('graduation_requests')
    .select(
      'id, enrollment_id, status, builder_at, enrollments(disciple_id, users(name), pathways(name))',
    )
    .eq('status', 'eligible');
  if (error) throw error;
  return data as unknown as EligibleGraduationRequest[];
}

export async function recommendGraduation(graduationRequestId: string): Promise<{
  status: GraduationRequestStatus;
}> {
  const { data, error } = await supabase
    .from('graduation_requests')
    .update({ builder_at: new Date().toISOString() })
    .eq('id', graduationRequestId)
    .select('status')
    .single();
  if (error) throw error;
  return data;
}

/** All weekly_checkins this Builder has proposed, across every assigned disciple. */
export async function listWeeklyCheckins(): Promise<WeeklyCheckinRow[]> {
  const { data, error } = await supabase
    .from('weekly_checkins')
    .select('id, disciple_id, scheduled_at, meet_link, status, proposed_times, report')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function proposeCheckinTimes(params: {
  builderId: string;
  discipleId: string;
  proposedTimes: [string, string, string];
  meetLink: string;
}): Promise<WeeklyCheckinRow> {
  const { data, error } = await supabase
    .from('weekly_checkins')
    .insert({
      builder_id: params.builderId,
      disciple_id: params.discipleId,
      proposed_times: params.proposedTimes,
      meet_link: params.meetLink,
    })
    .select('id, disciple_id, scheduled_at, meet_link, status, proposed_times, report')
    .single();
  if (error) throw error;
  return data;
}

export async function submitCheckinReport(
  weeklyCheckinId: string,
  report: string,
): Promise<WeeklyCheckinRow> {
  const { data, error } = await supabase
    .from('weekly_checkins')
    .update({ report, status: 'completed' })
    .eq('id', weeklyCheckinId)
    .select('id, disciple_id, scheduled_at, meet_link, status, proposed_times, report')
    .single();
  if (error) throw error;
  return data;
}
