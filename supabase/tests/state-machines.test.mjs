// Phase 2 state machine tests (MVP Dev Roadmap Gate: "Every state machine
// has passing unit tests for both valid and invalid transitions"). Tests
// the DB-level triggers/constraints directly against the real dev
// database — pathway_requests and graduation_requests status derivation,
// the graduation sequential CHECK, daily_checklists normalization, and
// the module_progress grading-column guard.
//
// Usage: node --env-file=.env --test supabase/tests/state-machines.test.mjs

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { adminClient, loadSeedUserIds } from './helpers.mjs';

let userIds;
let pathwayId;

before(async () => {
  userIds = await loadSeedUserIds();
  const { data: pathway, error } = await adminClient
    .from('pathways')
    .select('id')
    .eq('name', 'Seed Pathway: Finance')
    .single();
  if (error) throw error;
  pathwayId = pathway.id;
});

describe('pathway_requests status derivation', () => {
  let requestId;

  before(async () => {
    const { data, error } = await adminClient
      .from('pathway_requests')
      .insert({ disciple_id: userIds.disciple_1, pathway_id: pathwayId })
      .select('id')
      .single();
    if (error) throw error;
    requestId = data.id;
  });

  after(async () => {
    // Long-standing gap, only just surfaced: "becomes approved once BOTH
    // approvers have signed" drives this row through the Phase 4
    // apply_pathway_approval_to_enrollment cascade, which creates a REAL
    // active enrollment for disciple_1 — never cleaned up here before,
    // so a second run in the same session collides with
    // enrollments_one_active_per_disciple. Clean up the cascade's
    // children too (module_progress is ON DELETE RESTRICT on enrollments).
    const { data: enrollment } = await adminClient
      .from('enrollments')
      .select('id')
      .eq('disciple_id', userIds.disciple_1)
      .eq('pathway_id', pathwayId)
      .maybeSingle();
    if (enrollment) {
      await adminClient.from('module_progress').delete().eq('enrollment_id', enrollment.id);
      await adminClient.from('enrollments').delete().eq('id', enrollment.id);
    }
    await adminClient.from('pathway_requests').delete().eq('id', requestId);
    // Phase 8's notify_pathway_request_events trigger fires on this
    // describe block's own insert (LP/SM) and rejection (the disciple) —
    // clean those up too, or they leak into rls.test.mjs's notifications
    // RLS assertions for disciple_1 (a real interaction found by running
    // the full pipeline, not by re-reading either file in isolation).
    await adminClient
      .from('notifications')
      .delete()
      .eq('event_type', 'pathway_request_created')
      .contains('payload', { pathway_request_id: requestId });
    await adminClient
      .from('notifications')
      .delete()
      .eq('user_id', userIds.disciple_1)
      .eq('event_type', 'pathway_request_rejected')
      .contains('payload', { pathway_request_id: requestId });
  });

  it('starts as requested with neither approval set', async () => {
    const { data } = await adminClient
      .from('pathway_requests')
      .select('status')
      .eq('id', requestId)
      .single();
    assert.equal(data.status, 'requested');
  });

  it('becomes under_review once exactly one approver signs', async () => {
    const { data, error } = await adminClient
      .from('pathway_requests')
      .update({ sm_approved_at: new Date().toISOString() })
      .eq('id', requestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'under_review');
  });

  it('becomes approved once BOTH approvers have signed', async () => {
    const { data, error } = await adminClient
      .from('pathway_requests')
      .update({ lp_approved_at: new Date().toISOString() })
      .eq('id', requestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'approved');
  });

  it('a client-supplied status is ignored — it is always re-derived', async () => {
    const { data, error } = await adminClient
      .from('pathway_requests')
      .update({ status: 'rejected' }) // lp/sm approvals are still set; this should be overridden back to approved
      .eq('id', requestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(
      data.status,
      'approved',
      'trigger must re-derive status from the approval columns, not trust the client value',
    );
  });

  it('becomes rejected the moment a rejection_reason is set, regardless of prior approvals', async () => {
    const { data, error } = await adminClient
      .from('pathway_requests')
      .update({ rejection_reason: 'Test rejection' })
      .eq('id', requestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'rejected');
  });
});

describe('graduation_requests sequential enforcement + status derivation', () => {
  let enrollmentId;
  let graduationRequestId;

  before(async () => {
    const { data: enrollment, error: enrollmentError } = await adminClient
      .from('enrollments')
      .insert({ disciple_id: userIds.disciple_2, pathway_id: pathwayId })
      .select('id')
      .single();
    if (enrollmentError) throw enrollmentError;
    enrollmentId = enrollment.id;

    const { data: gradReq, error: gradError } = await adminClient
      .from('graduation_requests')
      .insert({ enrollment_id: enrollmentId })
      .select('id')
      .single();
    if (gradError) throw gradError;
    graduationRequestId = gradReq.id;
  });

  after(async () => {
    // The enrollment→module_progress cascade trigger (Phase 4) auto-creates
    // rows for this enrollment too — clear them before deleting the
    // enrollment (module_progress.enrollment_id is ON DELETE RESTRICT).
    await adminClient.from('graduation_requests').delete().eq('id', graduationRequestId);
    await adminClient.from('module_progress').delete().eq('enrollment_id', enrollmentId);
    await adminClient.from('enrollments').delete().eq('id', enrollmentId);
    // Phase 8's notify_graduation_request_events trigger fires as this
    // block advances builder_at -> sm_at -> lp_at.
    await adminClient
      .from('notifications')
      .delete()
      .eq('event_type', 'graduation_step_advanced')
      .contains('payload', { graduation_request_id: graduationRequestId });
  });

  it('INVALID: sm_at cannot be set while builder_at is null (the exact CHECK named in the roadmap)', async () => {
    const { error } = await adminClient
      .from('graduation_requests')
      .update({ sm_at: new Date().toISOString() })
      .eq('id', graduationRequestId);
    assert.ok(error, 'expected the CHECK constraint to reject this');
  });

  it('INVALID: lp_at cannot be set while sm_at is null', async () => {
    const { error } = await adminClient
      .from('graduation_requests')
      .update({ lp_at: new Date().toISOString() })
      .eq('id', graduationRequestId);
    assert.ok(error, 'expected the CHECK constraint to reject this');
  });

  it('VALID: builder_at alone -> builder_recommended', async () => {
    const { data, error } = await adminClient
      .from('graduation_requests')
      .update({ builder_at: new Date().toISOString() })
      .eq('id', graduationRequestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'builder_recommended');
  });

  it('VALID: builder_at + sm_at -> sm_reviewed', async () => {
    const { data, error } = await adminClient
      .from('graduation_requests')
      .update({ sm_at: new Date().toISOString() })
      .eq('id', graduationRequestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'sm_reviewed');
  });

  it('VALID: adding lp_at -> graduated, and cascades to the enrollment', async () => {
    const { data, error } = await adminClient
      .from('graduation_requests')
      .update({ lp_at: new Date().toISOString() })
      .eq('id', graduationRequestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'graduated');

    const { data: enrollment } = await adminClient
      .from('enrollments')
      .select('status, graduated_at')
      .eq('id', enrollmentId)
      .single();
    assert.equal(enrollment.status, 'graduated');
    assert.ok(enrollment.graduated_at, 'graduated_at should be set by the cascade trigger');
  });
});

describe('graduation_requests rejection derivation + rejected_by', () => {
  let enrollmentId;
  let graduationRequestId;

  before(async () => {
    const { data: enrollment } = await adminClient
      .from('enrollments')
      .insert({ disciple_id: userIds.disciple_3, pathway_id: pathwayId })
      .select('id')
      .single();
    enrollmentId = enrollment.id;

    const { data: gradReq } = await adminClient
      .from('graduation_requests')
      .insert({ enrollment_id: enrollmentId, builder_at: new Date().toISOString() })
      .select('id')
      .single();
    graduationRequestId = gradReq.id;
  });

  after(async () => {
    await adminClient.from('graduation_requests').delete().eq('id', graduationRequestId);
    await adminClient.from('module_progress').delete().eq('enrollment_id', enrollmentId);
    await adminClient.from('enrollments').delete().eq('id', enrollmentId);
    // Phase 8's notify_graduation_request_events trigger fires both on
    // this block's own insert (builder_at already set -> notifies SM) and
    // on the rejection below (routes back to the assigned Builder).
    await adminClient
      .from('notifications')
      .delete()
      .eq('event_type', 'graduation_step_advanced')
      .contains('payload', { graduation_request_id: graduationRequestId });
    await adminClient
      .from('notifications')
      .delete()
      .eq('event_type', 'graduation_request_rejected')
      .contains('payload', { graduation_request_id: graduationRequestId });
  });

  it('a rejection while sm_at is still null derives to rejected_by_sm', async () => {
    const { data, error } = await adminClient
      .from('graduation_requests')
      .update({ rejection_reason: 'Not ready yet' })
      .eq('id', graduationRequestId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'rejected_by_sm');
  });
});

describe('daily_checklists normalization + mandatory rejection reason', () => {
  let checklistId;

  before(async () => {
    const { data, error } = await adminClient
      .from('daily_checklists')
      .insert({ disciple_id: userIds.disciple_4, date: '2026-03-15' })
      .select('id')
      .single();
    if (error) throw error;
    checklistId = data.id;
  });

  after(async () => {
    await adminClient.from('daily_checklists').delete().eq('id', checklistId);
    // Phase 8's notify_checklist_submitted trigger fires on the
    // submitted -> pending_review normalization below.
    await adminClient
      .from('notifications')
      .delete()
      .eq('event_type', 'checklist_submitted')
      .contains('payload', { checklist_id: checklistId });
  });

  it('INVALID: needs_redo cannot be set without a rejection_reason', async () => {
    const { error } = await adminClient
      .from('daily_checklists')
      .update({ status: 'needs_redo' })
      .eq('id', checklistId);
    assert.ok(error, 'expected the trigger to reject a reasonless needs_redo');
  });

  it('VALID: submitted normalizes immediately to pending_review', async () => {
    const { data, error } = await adminClient
      .from('daily_checklists')
      .update({ status: 'submitted' })
      .eq('id', checklistId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'pending_review');
  });

  it('VALID: needs_redo WITH a reason normalizes to draft, reason is preserved', async () => {
    const { data, error } = await adminClient
      .from('daily_checklists')
      .update({ status: 'needs_redo', rejection_reason: 'Prayer time not logged' })
      .eq('id', checklistId)
      .select('status, rejection_reason')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'draft');
    assert.equal(data.rejection_reason, 'Prayer time not logged');
  });
});

describe('module_progress grading-column guard', () => {
  let enrollmentId;
  let moduleProgressId;
  let moduleId;

  before(async () => {
    const { data: enrollment } = await adminClient
      .from('enrollments')
      .insert({ disciple_id: userIds.disciple_5, pathway_id: pathwayId })
      .select('id')
      .single();
    enrollmentId = enrollment.id;

    const { data: modules } = await adminClient
      .from('modules')
      .select('id')
      .eq('pathway_id', pathwayId)
      .limit(1);
    moduleId = modules[0].id;

    // The enrollment→module_progress cascade trigger (Phase 4) already
    // inserted one row per pathway module for this enrollment — fetch the
    // one for moduleId rather than inserting a duplicate.
    const { data: progress, error: progressError } = await adminClient
      .from('module_progress')
      .select('id')
      .eq('enrollment_id', enrollmentId)
      .eq('module_id', moduleId)
      .single();
    if (progressError) throw progressError;
    moduleProgressId = progress.id;
  });

  after(async () => {
    // Delete all cascade-created rows for this enrollment, not just
    // moduleProgressId, or leftover rows block the enrollment delete below
    // (module_progress.enrollment_id is ON DELETE RESTRICT).
    await adminClient.from('module_progress').delete().eq('enrollment_id', enrollmentId);
    await adminClient.from('enrollments').delete().eq('id', enrollmentId);
    // Phase 8's notify_module_completed trigger fires when the test below
    // sets status='passed' — notifies the assigned Builder (realtime) and
    // every LP/SM (digest).
    await adminClient
      .from('notifications')
      .delete()
      .eq('event_type', 'module_completed')
      .contains('payload', { module_progress_id: moduleProgressId });
  });

  it("VALID (as service_role/admin): grading fields ARE writable — this is record-test-attempt's own write path", async () => {
    const { data, error } = await adminClient
      .from('module_progress')
      .update({ test_score: 80, status: 'passed', attempts: 1 })
      .eq('id', moduleProgressId)
      .select('status')
      .single();
    assert.equal(error, null);
    assert.equal(data.status, 'passed');
  });
});

describe('builder_active_disciple_count / capacity soft cap', () => {
  it('reflects the seeded pairings (builder_1 has 3 active disciples)', async () => {
    const { data, error } = await adminClient.rpc('builder_active_disciple_count', {
      p_builder_id: userIds.builder_1,
    });
    assert.equal(error, null);
    assert.equal(data, 3);
  });

  it('3 disciples does not exceed the 12 soft cap', async () => {
    const { data, error } = await adminClient.rpc('builder_exceeds_capacity_soft_cap', {
      p_builder_id: userIds.builder_1,
    });
    assert.equal(error, null);
    assert.equal(data, false);
  });
});
