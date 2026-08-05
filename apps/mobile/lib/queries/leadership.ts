import type { PathwayRequestStatus, GraduationRequestStatus } from '@isp-app/shared-types';

import { supabase } from '../supabase';

/**
 * Phase 6 data layer — Supervising Minister and Lead Pastor share this
 * file since both roles act on the same two approval queues, just at
 * different stages (Section C.1: parallel on pathway_requests; Section
 * C.3: sequential on graduation_requests). RLS already grants both roles
 * "read all, write own approval column" on both tables (Phase 1) — every
 * write here is a direct client call, no Edge Function needed, since
 * there's no cross-role column-guard gap left to close (the Phase 1 guard
 * triggers already own that) and no atomic multi-table side effect to
 * bundle (unlike review-checklist's notification-insert requirement).
 */

export type LeadershipRole = 'supervising_minister' | 'lead_pastor';

export interface PathwayApprovalRow {
  id: string;
  status: PathwayRequestStatus;
  lp_approved_at: string | null;
  sm_approved_at: string | null;
  created_at: string;
  users: { name: string };
  pathways: { name: string };
}

export interface GraduationApprovalRow {
  id: string;
  enrollment_id: string;
  status: GraduationRequestStatus;
  builder_at: string | null;
  sm_at: string | null;
  lp_at: string | null;
  enrollments: { disciple_id: string; users: { name: string }; pathways: { name: string } };
}

export interface DigestNotification {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface BuilderCapacityRow {
  id: string;
  name: string;
  activeDiscipleCount: number;
  overSoftCap: boolean;
}

export interface AtRiskDisciple {
  id: string;
  name: string;
  daysSinceLastChecklist: number | null;
}

const AT_RISK_THRESHOLD_DAYS = 3;

/** Pending pathway_requests this role hasn't yet acted on (Section C.1: parallel, either order). */
export async function listPathwayApprovalQueue(
  role: LeadershipRole,
): Promise<PathwayApprovalRow[]> {
  const column = role === 'supervising_minister' ? 'sm_approved_at' : 'lp_approved_at';
  const { data, error } = await supabase
    .from('pathway_requests')
    .select('id, status, lp_approved_at, sm_approved_at, created_at, users(name), pathways(name)')
    .in('status', ['requested', 'under_review'])
    .is(column, null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as unknown as PathwayApprovalRow[];
}

export async function approvePathwayRequest(
  id: string,
  role: LeadershipRole,
): Promise<{ status: PathwayRequestStatus }> {
  const column = role === 'supervising_minister' ? 'sm_approved_at' : 'lp_approved_at';
  const { data, error } = await supabase
    .from('pathway_requests')
    .update({ [column]: new Date().toISOString() })
    .eq('id', id)
    .select('status')
    .single();
  if (error) throw error;
  return data;
}

export async function rejectPathwayRequest(
  id: string,
  reason: string,
): Promise<{ status: PathwayRequestStatus }> {
  const { data, error } = await supabase
    .from('pathway_requests')
    .update({ rejection_reason: reason })
    .eq('id', id)
    .select('status')
    .single();
  if (error) throw error;
  return data;
}

/** graduation_requests waiting specifically on this role's step (Section C.3: sequential). */
export async function listGraduationApprovalQueue(
  role: LeadershipRole,
): Promise<GraduationApprovalRow[]> {
  const waitingStatus = role === 'supervising_minister' ? 'builder_recommended' : 'sm_reviewed';
  const { data, error } = await supabase
    .from('graduation_requests')
    .select(
      'id, enrollment_id, status, builder_at, sm_at, lp_at, enrollments(disciple_id, users(name), pathways(name))',
    )
    .eq('status', waitingStatus);
  if (error) throw error;
  return data as unknown as GraduationApprovalRow[];
}

export async function approveGraduationRequest(
  id: string,
  role: LeadershipRole,
): Promise<{ status: GraduationRequestStatus }> {
  const column = role === 'supervising_minister' ? 'sm_at' : 'lp_at';
  const { data, error } = await supabase
    .from('graduation_requests')
    .update({ [column]: new Date().toISOString() })
    .eq('id', id)
    .select('status')
    .single();
  if (error) throw error;
  return data;
}

export async function rejectGraduationRequest(
  id: string,
  reason: string,
): Promise<{ status: GraduationRequestStatus }> {
  const { data, error } = await supabase
    .from('graduation_requests')
    .update({ rejection_reason: reason })
    .eq('id', id)
    .select('status')
    .single();
  if (error) throw error;
  return data;
}

/**
 * Notifications actually compiled into today's digest (channel='digest').
 * No job populates these yet — that compilation job is explicit Phase 8
 * scope (roadmap: "Daily digest view (see Phase 8 — this is where the
 * digest actually surfaces)"). This screen reads real data honestly; it's
 * just real data that doesn't exist until Phase 8 ships the job.
 */
export async function listDigestNotifications(): Promise<DigestNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, event_type, payload, read_at, created_at')
    .eq('channel', 'digest')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export interface OrgStats {
  activeDisciples: number;
  pendingPathwayApprovals: number;
  pendingGraduationApprovals: number;
}

export async function getOrgStats(): Promise<OrgStats> {
  const [disciples, pathwayRequests, graduationRequests] = await Promise.all([
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'disciple')
      .eq('status', 'active'),
    supabase
      .from('pathway_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['requested', 'under_review']),
    supabase
      .from('graduation_requests')
      .select('id', { count: 'exact', head: true })
      .in('status', ['builder_recommended', 'sm_reviewed']),
  ]);
  if (disciples.error) throw disciples.error;
  if (pathwayRequests.error) throw pathwayRequests.error;
  if (graduationRequests.error) throw graduationRequests.error;

  return {
    activeDisciples: disciples.count ?? 0,
    pendingPathwayApprovals: pathwayRequests.count ?? 0,
    pendingGraduationApprovals: graduationRequests.count ?? 0,
  };
}

/**
 * "At-risk" = an actively-enrolled disciple with no daily_checklist
 * activity in the last 3+ days. That specific threshold comes from the
 * roadmap's own Phase 8 bullet ("Falling-behind detection (3+ days
 * inactive)") — reused here as a read-only dashboard flag, not the
 * proactive reminder/alert system Phase 8 builds around the same number.
 */
export async function listAtRiskDisciples(): Promise<AtRiskDisciple[]> {
  const { data: activeEnrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('disciple_id, users(name)')
    .eq('status', 'active');
  if (enrollmentsError) throw enrollmentsError;
  if (activeEnrollments.length === 0) return [];

  const { data: recentChecklists, error: checklistsError } = await supabase
    .from('daily_checklists')
    .select('disciple_id, date')
    .order('date', { ascending: false });
  if (checklistsError) throw checklistsError;

  const lastActivity = new Map<string, string>();
  for (const row of recentChecklists) {
    if (!lastActivity.has(row.disciple_id)) lastActivity.set(row.disciple_id, row.date);
  }

  const today = new Date();
  const atRisk: AtRiskDisciple[] = [];
  for (const enrollment of activeEnrollments as unknown as {
    disciple_id: string;
    users: { name: string };
  }[]) {
    const lastDate = lastActivity.get(enrollment.disciple_id);
    const daysSince = lastDate
      ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / 86_400_000)
      : null;
    if (daysSince === null || daysSince >= AT_RISK_THRESHOLD_DAYS) {
      atRisk.push({
        id: enrollment.disciple_id,
        name: enrollment.users.name,
        daysSinceLastChecklist: daysSince,
      });
    }
  }
  return atRisk;
}

/**
 * Direct aggregation over builder_disciple rather than the
 * builder_active_disciple_count RPC — SM/LP already have full RLS read
 * access to that table, so a client-side count avoids one RPC round-trip
 * per builder for what's a small roster at this scale.
 */
export async function listBuilderCapacity(): Promise<BuilderCapacityRow[]> {
  const [builders, pairings] = await Promise.all([
    supabase.from('users').select('id, name').eq('role', 'builder').eq('status', 'active'),
    supabase.from('builder_disciple').select('builder_id').eq('status', 'active'),
  ]);
  if (builders.error) throw builders.error;
  if (pairings.error) throw pairings.error;

  const counts = new Map<string, number>();
  for (const row of pairings.data) {
    counts.set(row.builder_id, (counts.get(row.builder_id) ?? 0) + 1);
  }

  return builders.data.map((builder) => {
    const activeDiscipleCount = counts.get(builder.id) ?? 0;
    return {
      id: builder.id,
      name: builder.name,
      activeDiscipleCount,
      overSoftCap: activeDiscipleCount > 12,
    };
  });
}

export interface RosterUser {
  id: string;
  name: string;
}

export async function listActiveDisciples(): Promise<RosterUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'disciple')
    .eq('status', 'active')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function listActiveBuilders(): Promise<RosterUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, name')
    .eq('role', 'builder')
    .eq('status', 'active')
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}
