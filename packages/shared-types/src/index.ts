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
