import {
  createPathwayRequestInputSchema,
  recordTestAttemptInputSchema,
  reassignBuilderInputSchema,
  reviewChecklistInputSchema,
  selectCheckinTimeInputSchema,
  userRoleSchema,
  userStatusSchema,
  uuidSchema,
} from './index';

describe('uuidSchema', () => {
  it('accepts a valid UUID', () => {
    expect(uuidSchema.safeParse('123e4567-e89b-12d3-a456-426614174000').success).toBe(true);
  });

  it('rejects a non-UUID string', () => {
    expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
  });
});

describe('userRoleSchema', () => {
  it('accepts each of the four confirmed MVP roles', () => {
    for (const role of ['lead_pastor', 'supervising_minister', 'builder', 'disciple']) {
      expect(userRoleSchema.safeParse(role).success).toBe(true);
    }
  });

  it('rejects an unconfirmed role like content_curriculum_admin', () => {
    expect(userRoleSchema.safeParse('content_curriculum_admin').success).toBe(false);
  });

  it('rejects free-text role values', () => {
    expect(userRoleSchema.safeParse('admin').success).toBe(false);
  });
});

describe('userStatusSchema', () => {
  it('accepts the soft-delete lifecycle states', () => {
    for (const status of ['active', 'inactive', 'withdrawn']) {
      expect(userStatusSchema.safeParse(status).success).toBe(true);
    }
  });

  it('rejects "deleted" — this project never hard-deletes users', () => {
    expect(userStatusSchema.safeParse('deleted').success).toBe(false);
  });
});

describe('createPathwayRequestInputSchema', () => {
  it('accepts a valid pathwayId', () => {
    expect(
      createPathwayRequestInputSchema.safeParse({
        pathwayId: '123e4567-e89b-12d3-a456-426614174000',
      }).success,
    ).toBe(true);
  });

  it('rejects a missing pathwayId', () => {
    expect(createPathwayRequestInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('reassignBuilderInputSchema', () => {
  const valid = {
    discipleId: '123e4567-e89b-12d3-a456-426614174000',
    newBuilderId: '223e4567-e89b-12d3-a456-426614174000',
    reason: 'Builder relocating',
  };

  it('accepts a fully-populated request', () => {
    expect(reassignBuilderInputSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty reason — Section F2 requires it on the ended pairing', () => {
    expect(reassignBuilderInputSchema.safeParse({ ...valid, reason: '' }).success).toBe(false);
  });
});

describe('recordTestAttemptInputSchema', () => {
  it('accepts a score within 0-100', () => {
    expect(
      recordTestAttemptInputSchema.safeParse({
        moduleProgressId: '123e4567-e89b-12d3-a456-426614174000',
        score: 65,
      }).success,
    ).toBe(true);
  });

  it('rejects a score above 100', () => {
    expect(
      recordTestAttemptInputSchema.safeParse({
        moduleProgressId: '123e4567-e89b-12d3-a456-426614174000',
        score: 101,
      }).success,
    ).toBe(false);
  });

  it('rejects a negative score', () => {
    expect(
      recordTestAttemptInputSchema.safeParse({
        moduleProgressId: '123e4567-e89b-12d3-a456-426614174000',
        score: -1,
      }).success,
    ).toBe(false);
  });
});

describe('reviewChecklistInputSchema', () => {
  const checklistId = '123e4567-e89b-12d3-a456-426614174000';

  it('accepts an approved decision with no reason', () => {
    expect(
      reviewChecklistInputSchema.safeParse({ checklistId, decision: 'approved' }).success,
    ).toBe(true);
  });

  it('accepts needs_redo with a rejection reason', () => {
    expect(
      reviewChecklistInputSchema.safeParse({
        checklistId,
        decision: 'needs_redo',
        rejectionReason: 'Prayer time not logged',
      }).success,
    ).toBe(true);
  });

  it('rejects needs_redo without a rejection reason (PRD Section C.3)', () => {
    expect(
      reviewChecklistInputSchema.safeParse({ checklistId, decision: 'needs_redo' }).success,
    ).toBe(false);
  });
});

describe('selectCheckinTimeInputSchema', () => {
  it('accepts a valid weeklyCheckinId and ISO chosenTime', () => {
    expect(
      selectCheckinTimeInputSchema.safeParse({
        weeklyCheckinId: '123e4567-e89b-12d3-a456-426614174000',
        chosenTime: '2026-08-10T15:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('rejects a non-ISO chosenTime', () => {
    expect(
      selectCheckinTimeInputSchema.safeParse({
        weeklyCheckinId: '123e4567-e89b-12d3-a456-426614174000',
        chosenTime: 'next tuesday',
      }).success,
    ).toBe(false);
  });
});
