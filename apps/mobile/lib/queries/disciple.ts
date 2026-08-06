import type { PathwayRequestStatus, ModuleProgressStatus } from '@isp-app/shared-types';

import { supabase } from '../supabase';

/**
 * Phase 4 data layer — every query here runs as the authenticated
 * disciple and relies entirely on the Phase 1 RLS policies to scope rows
 * (own pathway_requests, own enrollments via disciple_id, etc.). No
 * client-side filtering by user id is needed or trusted; RLS already
 * guarantees it at the database level.
 */

export interface Pathway {
  id: string;
  name: string;
  description: string | null;
}

export interface PathwayRequestRow {
  id: string;
  pathway_id: string;
  status: PathwayRequestStatus;
  lp_approved_at: string | null;
  sm_approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  pathways: Pathway;
}

export interface EnrollmentRow {
  id: string;
  pathway_id: string;
  status: 'active' | 'graduated' | 'withdrawn';
  started_at: string;
  graduated_at: string | null;
  pathways: Pathway;
}

export interface ModuleRow {
  id: string;
  pathway_id: string;
  order_index: number;
  title: string;
  video_url: string | null;
  notes: string | null;
}

export interface ModuleProgressRow {
  id: string;
  enrollment_id: string;
  module_id: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  test_score: number | null;
  attempts: number;
  status: ModuleProgressStatus;
  rewatch_required: boolean;
  rewatched_at: string | null;
  cooldown_until: string | null;
  failed_at: string | null;
  modules: ModuleRow;
}

export interface DailyChecklistRow {
  id: string;
  date: string;
  class_done: boolean;
  test_done: boolean;
  prayer_done: boolean;
  status: 'draft' | 'pending_review' | 'approved' | 'needs_redo';
  rejection_reason: string | null;
}

export interface GrowthProgressRow {
  current_stage_id: string;
  advanced_at: string;
  growth_stages: { id: string; name: string; order_index: number; criteria: string };
}

export async function listPathways(): Promise<Pathway[]> {
  const { data, error } = await supabase.from('pathways').select('id, name, description');
  if (error) throw error;
  return data;
}

/** Most recent pathway request, if any — covers requested/under_review/approved/rejected. */
export async function getMyLatestPathwayRequest(): Promise<PathwayRequestRow | null> {
  const { data, error } = await supabase
    .from('pathway_requests')
    .select(
      'id, pathway_id, status, lp_approved_at, sm_approved_at, rejection_reason, created_at, pathways(id, name, description)',
    )
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as PathwayRequestRow | null;
}

export async function getMyActiveEnrollment(): Promise<EnrollmentRow | null> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, pathway_id, status, started_at, graduated_at, pathways(id, name, description)')
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data as EnrollmentRow | null;
}

export async function getModuleProgressForEnrollment(
  enrollmentId: string,
): Promise<ModuleProgressRow[]> {
  const { data, error } = await supabase
    .from('module_progress')
    .select(
      'id, enrollment_id, module_id, clock_in_at, clock_out_at, test_score, attempts, status, rewatch_required, rewatched_at, cooldown_until, failed_at, modules(id, pathway_id, order_index, title, video_url, notes)',
    )
    .eq('enrollment_id', enrollmentId)
    .order('modules(order_index)', { ascending: true });
  if (error) throw error;
  return data as unknown as ModuleProgressRow[];
}

/** "Today" in the disciple's own device timezone, per the PRD's non-functional requirement. */
export function todayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getTodayChecklist(): Promise<DailyChecklistRow | null> {
  const { data, error } = await supabase
    .from('daily_checklists')
    .select('id, date, class_done, test_done, prayer_done, status, rejection_reason')
    .eq('date', todayLocalDate())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTodayChecklist(): Promise<DailyChecklistRow> {
  const { data, error } = await supabase
    .from('daily_checklists')
    .insert({ date: todayLocalDate() })
    .select('id, date, class_done, test_done, prayer_done, status, rejection_reason')
    .single();
  if (error) throw error;
  return data;
}

/**
 * class_done/test_done only — prayer_done is no longer a raw self-report
 * (Phase 7: locked to the clock-out-prayer Edge Function via a guard
 * trigger, since a checkbox alone isn't a genuine enough signal for the
 * prayer regimen, PRD Section E). A direct write here would be rejected
 * by that trigger.
 */
export async function updateChecklistItem(
  id: string,
  patch: Partial<Pick<DailyChecklistRow, 'class_done' | 'test_done'>>,
): Promise<DailyChecklistRow> {
  const { data, error } = await supabase
    .from('daily_checklists')
    .update(patch)
    .eq('id', id)
    .select('id, date, class_done, test_done, prayer_done, status, rejection_reason')
    .single();
  if (error) throw error;
  return data;
}

export async function submitChecklist(id: string): Promise<DailyChecklistRow> {
  // The daily_checklists state-machine trigger (Phase 2) normalizes
  // 'submitted' to 'pending_review' immediately — this write's intent is
  // "I'm done for today," not a status value the client controls precisely.
  const { data, error } = await supabase
    .from('daily_checklists')
    .update({ status: 'submitted' })
    .eq('id', id)
    .select('id, date, class_done, test_done, prayer_done, status, rejection_reason')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Consecutive prior days with an approved checklist, counting back from
 * yesterday (today's own checklist isn't finished yet, so it never counts
 * toward the streak while still in progress). No streak column exists in
 * the schema — this derives it from real history each time rather than
 * maintaining a separately-cached counter that could drift.
 */
export async function getChecklistStreak(): Promise<number> {
  const { data, error } = await supabase
    .from('daily_checklists')
    .select('date, status')
    .order('date', { ascending: false })
    .limit(60);
  if (error) throw error;

  const approvedDates = new Set(
    data.filter((row) => row.status === 'approved').map((row) => row.date),
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - 1); // start from yesterday

  for (;;) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    const key = `${year}-${month}-${day}`;
    if (!approvedDates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export async function getMyGrowthProgress(): Promise<GrowthProgressRow | null> {
  const { data, error } = await supabase
    .from('disciple_growth_progress')
    .select('current_stage_id, advanced_at, growth_stages(id, name, order_index, criteria)')
    .maybeSingle();
  if (error) throw error;
  return data as unknown as GrowthProgressRow | null;
}

export async function listGrowthStages(): Promise<GrowthProgressRow['growth_stages'][]> {
  const { data, error } = await supabase
    .from('growth_stages')
    .select('id, name, order_index, criteria')
    .order('order_index', { ascending: true });
  if (error) throw error;
  return data;
}

export interface WeeklyCheckinRow {
  id: string;
  scheduled_at: string | null;
  meet_link: string | null;
  status: 'proposed' | 'scheduled' | 'completed' | 'cancelled';
  proposed_times: string[] | null;
}

/** The most recent check-in still needing disciple/Builder action (proposed or scheduled), if any. */
export async function getMyActiveWeeklyCheckin(): Promise<WeeklyCheckinRow | null> {
  const { data, error } = await supabase
    .from('weekly_checkins')
    .select('id, scheduled_at, meet_link, status, proposed_times')
    .in('status', ['proposed', 'scheduled'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface PrayerSessionRow {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
}

/**
 * The disciple's assigned Builder — always exactly one active pairing at a
 * time (Phase 1 unique index). Two plain queries rather than an embedded
 * select: builder_disciple has three FKs to users (builder/disciple/
 * assigned_by), so an embedded `users(...)` would need PostgREST's FK
 * hint syntax, which is easy to get subtly wrong.
 */
export async function getMyActiveBuilder(): Promise<{ id: string; name: string } | null> {
  const { data: pairing, error: pairingError } = await supabase
    .from('builder_disciple')
    .select('builder_id')
    .eq('status', 'active')
    .maybeSingle();
  if (pairingError) throw pairingError;
  if (!pairing) return null;

  const { data: builder, error: builderError } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', pairing.builder_id)
    .single();
  if (builderError) throw builderError;
  return builder;
}

/** An in-progress prayer session (clocked in, not yet out), if any. */
export async function getMyActivePrayerSession(): Promise<PrayerSessionRow | null> {
  const { data, error } = await supabase
    .from('prayer_sessions')
    .select('id, clock_in_at, clock_out_at')
    .is('clock_out_at', null)
    .order('clock_in_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function startPrayerSession(): Promise<PrayerSessionRow> {
  const { data, error } = await supabase
    .from('prayer_sessions')
    .insert({})
    .select('id, clock_in_at, clock_out_at')
    .single();
  if (error) throw error;
  return data;
}
