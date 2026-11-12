import { describe, it, expect } from 'vitest';
import {
  assertTenantAccess,
  hasRole,
  applyTenantFilter,
  UserContext,
} from '../src/lib/auth/org-context';

describe('BidReady Data Isolation & Multi-Tenancy Boundary', () => {
  const mockUserContext: UserContext = {
    userId: 'user-alpha-123',
    email: 'analyst@defensecorp.com',
    activeOrgId: 'org-tenant-A',
    role: 'member',
    organizations: [
      {
        organization: {
          id: 'org-tenant-A',
          name: 'Defense Systems Corp',
          slug: 'defense-systems-corp',
          billing_email: 'billing@defensecorp.com',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        role: 'member',
      },
    ],
  };

  it('allows access when user belongs to the requested organization', () => {
    expect(() => {
      assertTenantAccess(mockUserContext, 'org-tenant-A');
    }).not.toThrow();
  });

  it('blocks and throws error on cross-tenant access attempt to foreign organization', () => {
    const foreignTenantId = 'org-tenant-B-competitor';

    expect(() => {
      assertTenantAccess(mockUserContext, foreignTenantId);
    }).toThrowError(/Cross-tenant access denied/);
  });

  it('throws authorization error if session context is missing or unauthenticated', () => {
    const emptyContext = {} as UserContext;

    expect(() => {
      assertTenantAccess(emptyContext, 'org-tenant-A');
    }).toThrowError(/Unauthorized: No authenticated user session/);
  });

  it('enforces organization_id injection into all database query scopes', () => {
    const queryParams = { status: 'review', stage: 'analyzing' };
    const scopedQuery = applyTenantFilter(queryParams, 'org-tenant-A');

    expect(scopedQuery).toEqual({
      status: 'review',
      stage: 'analyzing',
      organization_id: 'org-tenant-A',
    });
  });

  it('rejects queries attempted without a valid tenant identifier', () => {
    expect(() => {
      applyTenantFilter({ search: 'radar' }, '');
    }).toThrowError(/Security Violation: Attempted to run query without an organization_id scope/);
  });
});

describe('Role-Based Access Control (RBAC) Hierarchies', () => {
  it('correctly assesses role permissions in hierarchical order', () => {
    // Owner has permissions of owner, admin, member, viewer
    expect(hasRole('owner', 'owner')).toBe(true);
    expect(hasRole('owner', 'admin')).toBe(true);
    expect(hasRole('owner', 'member')).toBe(true);
    expect(hasRole('owner', 'viewer')).toBe(true);

    // Admin has permissions of admin, member, viewer, but NOT owner
    expect(hasRole('admin', 'owner')).toBe(false);
    expect(hasRole('admin', 'admin')).toBe(true);
    expect(hasRole('admin', 'member')).toBe(true);

    // Member has member and viewer, but not admin or owner
    expect(hasRole('member', 'admin')).toBe(false);
    expect(hasRole('member', 'member')).toBe(true);
    expect(hasRole('member', 'viewer')).toBe(true);

    // Viewer only has viewer
    expect(hasRole('viewer', 'member')).toBe(false);
    expect(hasRole('viewer', 'viewer')).toBe(true);
  });
});
