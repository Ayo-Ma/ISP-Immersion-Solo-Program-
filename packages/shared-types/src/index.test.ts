import { userRoleSchema, userStatusSchema, uuidSchema } from './index';

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
