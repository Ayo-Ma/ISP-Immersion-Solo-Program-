// Test-owned fixture data: one row per workflow table, built fresh on each
// test run and torn down after. Distinct from supabase/seed/seed.mjs,
// which seeds durable data for manual exploration — these rows exist only
// to give the RLS test suite real, known rows to assert visibility against
// on tables the seed script deliberately doesn't touch (workflow state is
// Phase 2's job to generate, not something to fake here).

import { adminClient, loadSeedUserIds } from './helpers.mjs';

async function findPathwayAndModules() {
  const { data: pathway, error: pathwayError } = await adminClient
    .from('pathways')
    .select('id')
    .eq('name', 'Seed Pathway: Finance')
    .single();
  if (pathwayError) throw pathwayError;

  const { data: modules, error: modulesError } = await adminClient
    .from('modules')
    .select('id, order_index')
    .eq('pathway_id', pathway.id)
    .order('order_index');
  if (modulesError) throw modulesError;

  return { pathwayId: pathway.id, moduleIds: modules.map((m) => m.id) };
}

async function deleteFixtures(ids) {
  // Delete order matters: children before parents (FKs are ON DELETE
  // RESTRICT throughout, per Section E).
  await adminClient.from('graduation_requests').delete().eq('id', ids.graduationRequestId);
  await adminClient.from('module_progress').delete().eq('id', ids.moduleProgressId);
  await adminClient.from('enrollments').delete().eq('id', ids.enrollmentId);
  await adminClient.from('pathway_requests').delete().eq('id', ids.pathwayRequestId);
  await adminClient.from('daily_checklists').delete().eq('id', ids.dailyChecklistId);
  await adminClient.from('chat_messages').delete().eq('id', ids.chatMessageId);
  await adminClient.from('weekly_checkins').delete().eq('id', ids.weeklyCheckinId);
  await adminClient.from('notifications').delete().eq('id', ids.notificationId);
  await adminClient
    .from('disciple_growth_progress')
    .delete()
    .eq('id', ids.discipleGrowthProgressId);
  await adminClient.from('growth_stages').delete().eq('id', ids.growthStageId);
  await adminClient.from('approval_delegations').delete().eq('id', ids.approvalDelegationId);
}

export async function setupFixtures() {
  const userIds = await loadSeedUserIds();
  const { pathwayId, moduleIds } = await findPathwayAndModules();

  // Defensive cleanup in case a previous run crashed mid-way — matched by
  // the well-known fixture markers used below, not a blind wipe.
  await adminClient
    .from('daily_checklists')
    .delete()
    .eq('disciple_id', userIds.disciple_1)
    .eq('date', '2026-01-01');
  await adminClient.from('growth_stages').delete().eq('name', 'RLS Test Stage');
  await adminClient
    .from('approval_delegations')
    .delete()
    .eq('primary_user_id', userIds.supervising_minister)
    .eq('reason', 'RLS test fixture');

  const pathwayRequest = await adminClient
    .from('pathway_requests')
    .insert({ disciple_id: userIds.disciple_1, pathway_id: pathwayId })
    .select('id')
    .single();
  if (pathwayRequest.error) throw pathwayRequest.error;

  const enrollment = await adminClient
    .from('enrollments')
    .insert({ disciple_id: userIds.disciple_1, pathway_id: pathwayId })
    .select('id')
    .single();
  if (enrollment.error) throw enrollment.error;

  const moduleProgress = await adminClient
    .from('module_progress')
    .insert({ enrollment_id: enrollment.data.id, module_id: moduleIds[0] })
    .select('id')
    .single();
  if (moduleProgress.error) throw moduleProgress.error;

  const graduationRequest = await adminClient
    .from('graduation_requests')
    .insert({ enrollment_id: enrollment.data.id })
    .select('id')
    .single();
  if (graduationRequest.error) throw graduationRequest.error;

  const dailyChecklist = await adminClient
    .from('daily_checklists')
    .insert({ disciple_id: userIds.disciple_1, date: '2026-01-01' })
    .select('id')
    .single();
  if (dailyChecklist.error) throw dailyChecklist.error;

  const chatMessage = await adminClient
    .from('chat_messages')
    .insert({
      builder_id: userIds.builder_1,
      disciple_id: userIds.disciple_1,
      sender_id: userIds.builder_1,
      body: 'RLS test fixture message',
    })
    .select('id')
    .single();
  if (chatMessage.error) throw chatMessage.error;

  const weeklyCheckin = await adminClient
    .from('weekly_checkins')
    .insert({ builder_id: userIds.builder_1, disciple_id: userIds.disciple_1 })
    .select('id')
    .single();
  if (weeklyCheckin.error) throw weeklyCheckin.error;

  const notification = await adminClient
    .from('notifications')
    .insert({
      user_id: userIds.disciple_1,
      event_type: 'rls_test_fixture',
      channel: 'realtime',
    })
    .select('id')
    .single();
  if (notification.error) throw notification.error;

  const growthStage = await adminClient
    .from('growth_stages')
    .insert({ name: 'RLS Test Stage', order_index: 999, criteria: 'Fixture only' })
    .select('id')
    .single();
  if (growthStage.error) throw growthStage.error;

  const discipleGrowthProgress = await adminClient
    .from('disciple_growth_progress')
    .insert({ disciple_id: userIds.disciple_1, current_stage_id: growthStage.data.id })
    .select('id')
    .single();
  if (discipleGrowthProgress.error) throw discipleGrowthProgress.error;

  const approvalDelegation = await adminClient
    .from('approval_delegations')
    .insert({
      role: 'supervising_minister',
      primary_user_id: userIds.supervising_minister,
      delegate_user_id: userIds.lead_pastor,
      reason: 'RLS test fixture',
    })
    .select('id')
    .single();
  if (approvalDelegation.error) throw approvalDelegation.error;

  return {
    userIds,
    pathwayId,
    moduleIds,
    pathwayRequestId: pathwayRequest.data.id,
    enrollmentId: enrollment.data.id,
    moduleProgressId: moduleProgress.data.id,
    graduationRequestId: graduationRequest.data.id,
    dailyChecklistId: dailyChecklist.data.id,
    chatMessageId: chatMessage.data.id,
    weeklyCheckinId: weeklyCheckin.data.id,
    notificationId: notification.data.id,
    growthStageId: growthStage.data.id,
    discipleGrowthProgressId: discipleGrowthProgress.data.id,
    approvalDelegationId: approvalDelegation.data.id,
  };
}

export async function teardownFixtures(fixtureIds) {
  await deleteFixtures(fixtureIds);
}
