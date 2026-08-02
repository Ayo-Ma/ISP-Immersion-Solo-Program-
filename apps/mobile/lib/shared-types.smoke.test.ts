import { userRoleSchema, createPathwayRequestInputSchema } from '@isp-app/shared-types';

// Proves packages/shared-types is actually resolvable and usable from the
// Expo app via the npm workspace link, not just typechecked in isolation —
// the MVP Dev Roadmap's Phase 2 Gate is explicit that it must be
// "importable by the frontend."
describe('@isp-app/shared-types (cross-workspace import)', () => {
  it('resolves and validates like it does inside the package itself', () => {
    expect(userRoleSchema.safeParse('disciple').success).toBe(true);
    expect(userRoleSchema.safeParse('not-a-role').success).toBe(false);
    expect(
      createPathwayRequestInputSchema.safeParse({
        pathwayId: '123e4567-e89b-12d3-a456-426614174000',
      }).success,
    ).toBe(true);
  });
});
