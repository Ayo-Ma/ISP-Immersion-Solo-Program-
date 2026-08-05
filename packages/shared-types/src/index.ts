import { z } from 'zod';

/**
 * Shared Zod schemas for values that cross the frontend/backend boundary.
 * Per Backend System Design (Section A/E): every status/role field is an
 * enum, never free text, and every primary key is a UUID.
 *
 * Full per-table request/response schemas (pathway requests, checklists,
 * graduation, etc.) are Phase 2 scope (Core Domain Logic / Edge Functions) —
 * this file only holds the primitives that are already locked in.
 */

export const uuidSchema = z.string().uuid();

/**
 * The four roles confirmed active at MVP (PRD Section A). A fifth role,
 * Content/Curriculum Admin, was recommended but is still an open item
 * pending Lead Pastor confirmation (see PRD Section E / Context Handoff
 * Section 6) — deliberately excluded until that's locked in.
 */
export const userRoleSchema = z.enum([
  'lead_pastor',
  'supervising_minister',
  'builder',
  'disciple',
]);
export type UserRole = z.infer<typeof userRoleSchema>;

/**
 * Soft-delete lifecycle only (Backend System Design, Section E) — a user
 * row is never hard-deleted, so history and foreign keys stay intact.
 */
export const userStatusSchema = z.enum(['active', 'inactive', 'withdrawn']);
export type UserStatus = z.infer<typeof userStatusSchema>;

/**
 * Phase 2: Core Domain Logic. One input/output schema pair per Edge
 * Function (MVP Dev Roadmap, Phase 2 checklist: "Zod schemas for every
 * Edge Function input/output, shared with frontend via
 * packages/shared-types"). Status enums here mirror the Postgres enums in
 * supabase/migrations/20260802165300_enums.sql — the two must be kept in
 * sync by hand, there's no code generation between them.
 */

export const pathwayRequestStatusSchema = z.enum([
  'requested',
  'under_review',
  'approved',
  'rejected',
]);
export type PathwayRequestStatus = z.infer<typeof pathwayRequestStatusSchema>;

export const graduationRequestStatusSchema = z.enum([
  'eligible',
  'builder_recommended',
  'sm_reviewed',
  'rejected_by_sm',
  'lp_approved',
  'graduated',
  'rejected_by_lp',
]);
export type GraduationRequestStatus = z.infer<typeof graduationRequestStatusSchema>;

export const moduleProgressStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'passed',
  'failed',
]);
export type ModuleProgressStatus = z.infer<typeof moduleProgressStatusSchema>;

export const checklistStatusSchema = z.enum([
  'draft',
  'submitted',
  'pending_review',
  'approved',
  'needs_redo',
]);
export type ChecklistStatus = z.infer<typeof checklistStatusSchema>;

export const weeklyCheckinStatusSchema = z.enum([
  'proposed',
  'scheduled',
  'completed',
  'cancelled',
]);
export type WeeklyCheckinStatus = z.infer<typeof weeklyCheckinStatusSchema>;

// ---- create-pathway-request -----------------------------------------

export const createPathwayRequestInputSchema = z.object({
  pathwayId: uuidSchema,
});
export type CreatePathwayRequestInput = z.infer<typeof createPathwayRequestInputSchema>;

export const createPathwayRequestOutputSchema = z.object({
  pathwayRequestId: uuidSchema,
  status: pathwayRequestStatusSchema,
});
export type CreatePathwayRequestOutput = z.infer<typeof createPathwayRequestOutputSchema>;

// ---- reassign-builder --------------------------------------------------

export const reassignBuilderInputSchema = z.object({
  discipleId: uuidSchema,
  newBuilderId: uuidSchema,
  reason: z.string().min(1, 'reason is required — Section F2 preserves it on the ended pairing'),
});
export type ReassignBuilderInput = z.infer<typeof reassignBuilderInputSchema>;

export const reassignBuilderOutputSchema = z.object({
  newPairingId: uuidSchema,
  newBuilderActiveDiscipleCount: z.number().int().nonnegative(),
  builderExceedsCapacitySoftCap: z.boolean(),
});
export type ReassignBuilderOutput = z.infer<typeof reassignBuilderOutputSchema>;

// ---- record-test-attempt -----------------------------------------------

export const recordTestAttemptInputSchema = z.object({
  moduleProgressId: uuidSchema,
  score: z.number().min(0).max(100),
});
export type RecordTestAttemptInput = z.infer<typeof recordTestAttemptInputSchema>;

export const recordTestAttemptOutputSchema = z.object({
  status: z.enum(['passed', 'failed']),
  attempts: z.number().int().positive(),
  rewatchRequired: z.boolean(),
  cooldownUntil: z.string().datetime().nullable(),
  builderAlerted: z.boolean(),
});
export type RecordTestAttemptOutput = z.infer<typeof recordTestAttemptOutputSchema>;

// ---- review-checklist ----------------------------------------------------

export const reviewChecklistInputSchema = z
  .object({
    checklistId: uuidSchema,
    decision: z.enum(['approved', 'needs_redo']),
    rejectionReason: z.string().min(1).optional(),
  })
  .refine((v) => v.decision !== 'needs_redo' || !!v.rejectionReason, {
    message: 'rejectionReason is required when decision is needs_redo (PRD Section C.3).',
    path: ['rejectionReason'],
  });
export type ReviewChecklistInput = z.infer<typeof reviewChecklistInputSchema>;

export const reviewChecklistOutputSchema = z.object({
  checklistId: uuidSchema,
  status: checklistStatusSchema,
});
export type ReviewChecklistOutput = z.infer<typeof reviewChecklistOutputSchema>;

// ---- select-checkin-time -------------------------------------------------

export const selectCheckinTimeInputSchema = z.object({
  weeklyCheckinId: uuidSchema,
  chosenTime: z.string().datetime(),
});
export type SelectCheckinTimeInput = z.infer<typeof selectCheckinTimeInputSchema>;

export const selectCheckinTimeOutputSchema = z.object({
  weeklyCheckinId: uuidSchema,
  status: weeklyCheckinStatusSchema,
  scheduledAt: z.string().datetime(),
});
export type SelectCheckinTimeOutput = z.infer<typeof selectCheckinTimeOutputSchema>;
