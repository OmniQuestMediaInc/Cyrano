// services/studio-affiliation/src/studio-rbac.guard.spec.ts
// RBAC-STUDIO-001 — pure matrix test (no DB dependency).
import { StudioRbacGuard } from './studio-rbac.guard';

describe('StudioRbacGuard.getRequiredRoles (matrix)', () => {
  it('studio:manage requires STUDIO_OWNER only', () => {
    expect(StudioRbacGuard.getRequiredRoles('studio:manage')).toEqual(['STUDIO_OWNER']);
  });

  it('studio:invite-creator allows owner + admin', () => {
    expect(StudioRbacGuard.getRequiredRoles('studio:invite-creator')).toEqual([
      'STUDIO_OWNER',
      'STUDIO_ADMIN',
    ]);
  });

  it('studio:view-affiliations allows any active member', () => {
    expect(StudioRbacGuard.getRequiredRoles('studio:view-affiliations')).toEqual([
      'STUDIO_OWNER',
      'STUDIO_ADMIN',
      'CREATOR',
    ]);
  });

  it('studio:upload-contract allows owner + admin', () => {
    expect(StudioRbacGuard.getRequiredRoles('studio:upload-contract')).toEqual([
      'STUDIO_OWNER',
      'STUDIO_ADMIN',
    ]);
  });

  it('studio:view-commission allows owner + admin (PLATFORM_ADMIN bypasses via RbacService)', () => {
    expect(StudioRbacGuard.getRequiredRoles('studio:view-commission')).toEqual([
      'STUDIO_OWNER',
      'STUDIO_ADMIN',
    ]);
  });
});
