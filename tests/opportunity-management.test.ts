import { describe, it, expect } from 'vitest';
import { OpportunityService } from '../src/lib/opportunities/service';
import { NotificationService } from '../src/lib/notifications/service';

describe('Opportunity Management, Readiness Calculations & Audit Trail', () => {
  const oppService = new OpportunityService();
  const orgId = 'org-1';

  it('manages opportunity creation and stage transitions with audit logging', () => {
    const opp = oppService.createOpportunity({
      organizationId: orgId,
      userId: 'user-lead-1',
      title: 'US Space Force Telemetry Framework',
      referenceCode: 'RFP-USSF-2026-99',
      issuingBody: 'US Space Force',
      estimatedValue: 8500000,
      currency: 'USD',
      priority: 'high',
    });

    expect(opp.id).toBeDefined();
    expect(opp.stage).toBe('DISCOVERED');

    // Update stage to IN_PREPARATION
    const updated = oppService.updateOpportunity(opp.id, orgId, 'user-lead-1', {
      stage: 'IN_PREPARATION',
      priority: 'urgent',
    });

    expect(updated.stage).toBe('IN_PREPARATION');
    expect(updated.priority).toBe('urgent');

    // Verify activity trail
    const activities = oppService.getActivities(opp.id, orgId);
    expect(activities.length).toBeGreaterThanOrEqual(2);
    expect(activities.some((a) => a.action === 'STATUS_CHANGE')).toBe(true);
    expect(activities.some((a) => a.action === 'PRIORITY_UPDATED')).toBe(true);
  });

  it('transparently calculates readiness overview without deceptive compliance percentages', () => {
    const overview = oppService.getReadinessOverview('opp-faa-radar-098', orgId);

    expect(overview.opportunity_id).toBe('opp-faa-radar-098');
    expect(overview.total_requirements).toBe(6);
    expect(overview.matched_count).toBeGreaterThan(0);

    // Because FAA Radar has 1 expired evidence (insurance policy), stage must be ACTION_REQUIRED
    expect(overview.readiness_stage).toBe('ACTION_REQUIRED');
    expect(overview.expired_evidence_count).toBeGreaterThan(0);
    expect(overview.calculation_explanation).toContain('expired evidence');
    expect(overview.disclaimer).toContain('does not provide legal advice');
  });

  it('enforces multi-tenant isolation on opportunities', () => {
    expect(() => {
      oppService.getOpportunity('opp-faa-radar-098', 'competitor-org-99');
    }).toThrowError(/Cross-tenant access denied/);
  });
});

describe('Internal Notification System Tests', () => {
  const notifService = new NotificationService();
  const orgId = 'org-1';

  it('dispatches, lists and marks internal notifications as read', () => {
    const notif = notifService.createNotification({
      organizationId: orgId,
      type: 'DEADLINE_APPROACHING',
      title: 'Submission Due in 48 Hours',
      message: 'Defense solicitation cutoff is approaching.',
      severity: 'critical',
      linkUrl: '/opportunities',
    });

    expect(notif.id).toBeDefined();
    expect(notif.is_read).toBe(false);

    const list = notifService.listNotifications(orgId);
    expect(list.some((n) => n.id === notif.id)).toBe(true);

    // Mark as read
    const success = notifService.markAsRead(notif.id, orgId);
    expect(success).toBe(true);

    const updatedList = notifService.listNotifications(orgId);
    const readItem = updatedList.find((n) => n.id === notif.id);
    expect(readItem?.is_read).toBe(true);
  });
});
