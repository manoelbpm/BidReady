import { Organization, OrganizationMember, MembershipRole } from '@/types/models';

export interface UserContext {
  userId: string;
  email: string;
  activeOrgId: string;
  role: MembershipRole;
  organizations: Array<{
    organization: Organization;
    role: MembershipRole;
  }>;
}

/**
 * Validates that an operation attempting to access a specific organization
 * is authorized for the current user's membership.
 * Throws an explicit error if a cross-tenant boundary breach is attempted.
 */
export function assertTenantAccess(userContext: UserContext, targetOrgId: string): void {
  if (!userContext || !userContext.userId) {
    throw new Error('Unauthorized: No authenticated user session.');
  }

  const membership = userContext.organizations.find(
    (m) => m.organization.id === targetOrgId
  );

  if (!membership) {
    throw new Error(`Forbidden: Cross-tenant access denied. User ${userContext.userId} is not a member of organization ${targetOrgId}.`);
  }
}

/**
 * Checks whether the user has required role hierarchy in the active organization.
 */
export function hasRole(currentRole: MembershipRole, requiredRole: MembershipRole): boolean {
  const roleHierarchy: Record<MembershipRole, number> = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
  };

  return (roleHierarchy[currentRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0);
}

/**
 * Multi-tenant query boundary helper.
 * Enforces that every database filter includes organization_id equality check.
 */
export function applyTenantFilter<T extends Record<string, unknown>>(
  filters: T,
  organizationId: string
): T & { organization_id: string } {
  if (!organizationId) {
    throw new Error('Security Violation: Attempted to run query without an organization_id scope.');
  }
  return {
    ...filters,
    organization_id: organizationId,
  };
}
