import { InternalNotification, NotificationType } from '@/types/models';
import { NotificationRepository } from '@/lib/supabase/repositories/notification-repository';

const notificationStore = new Map<string, InternalNotification[]>();

// Seed initial realistic enterprise notifications for demonstration
function seedInitialNotifications() {
  if (notificationStore.size > 0) return;

  const defaultNotifications: InternalNotification[] = [
    {
      id: 'notif-1',
      organization_id: 'org-1',
      type: 'DEADLINE_APPROACHING',
      title: 'Clarification Deadline in 4 Days',
      message: 'FAA NextGen Radar (RFP-2026-FAA-098) clarification questions cutoff is November 25, 2026 at 17:00 EST.',
      severity: 'warning',
      link_url: '/opportunities',
      is_read: false,
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'notif-2',
      organization_id: 'org-1',
      type: 'EVIDENCE_EXPIRING',
      title: 'Commercial Liability Policy Expired',
      message: 'Commercial General Liability Policy ($5M) has expired. Renewal certificate must be uploaded before final tender submission.',
      severity: 'critical',
      link_url: '/evidence',
      is_read: false,
      created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    },
    {
      id: 'notif-3',
      organization_id: 'org-1',
      type: 'REVIEW_PENDING',
      title: 'Compliance Matching Requires Verification',
      message: 'FAA Radar Framework: 1 desirable requirement has low extraction confidence (82%) and requires manual review.',
      severity: 'info',
      link_url: '/checklist',
      is_read: true,
      created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
  ];

  notificationStore.set('org-1', defaultNotifications);
}

seedInitialNotifications();

export class NotificationService {
  private repository?: NotificationRepository;

  constructor(repository?: NotificationRepository) {
    this.repository = repository;
  }

  /**
   * Retrieves all notifications for an organization.
   */
  listNotifications(organizationId: string): InternalNotification[] {
    seedInitialNotifications();
    const list = notificationStore.get(organizationId) || [];
    return [...list].sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
  }

  /**
   * Dispatches a new internal notification.
   */
  createNotification(params: {
    organizationId: string;
    userId?: string;
    type: NotificationType;
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'critical';
    linkUrl?: string;
  }): InternalNotification {
    const {
      organizationId,
      userId,
      type,
      title,
      message,
      severity = 'info',
      linkUrl,
    } = params;

    const notif: InternalNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      organization_id: organizationId,
      user_id: userId || null,
      type,
      title,
      message,
      severity,
      link_url: linkUrl,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    const existing = notificationStore.get(organizationId) || [];
    existing.unshift(notif);
    notificationStore.set(organizationId, existing);

    return notif;
  }

  /**
   * Marks a notification as read.
   */
  markAsRead(notificationId: string, organizationId: string): boolean {
    const list = notificationStore.get(organizationId);
    if (!list) return false;

    const notif = list.find((n) => n.id === notificationId);
    if (!notif) return false;

    notif.is_read = true;
    return true;
  }

  /**
   * Marks all notifications as read for an organization.
   */
  markAllAsRead(organizationId: string): void {
    const list = notificationStore.get(organizationId);
    if (!list) return;
    list.forEach((n) => (n.is_read = true));
  }

  // --- Real Supabase PostgreSQL Async Methods ---

  async listNotificationsAsync(organizationId: string): Promise<InternalNotification[]> {
    if (this.repository) {
      return this.repository.listNotifications(organizationId);
    }
    return this.listNotifications(organizationId);
  }

  async createNotificationAsync(params: {
    organizationId: string;
    userId?: string;
    type: NotificationType;
    title: string;
    message: string;
    severity?: 'info' | 'warning' | 'critical';
    linkUrl?: string;
  }): Promise<InternalNotification> {
    if (this.repository) {
      return this.repository.createNotification({
        organization_id: params.organizationId,
        user_id: params.userId || null,
        type: params.type,
        title: params.title,
        message: params.message,
        severity: params.severity || 'info',
        link_url: params.linkUrl || null,
      });
    }
    return this.createNotification(params);
  }

  async markAsReadAsync(notificationId: string): Promise<InternalNotification | null> {
    if (this.repository) {
      return this.repository.markAsRead(notificationId);
    }
    return null;
  }

  async markAllAsReadAsync(organizationId: string): Promise<void> {
    if (this.repository) {
      await this.repository.markAllAsRead(organizationId);
      return;
    }
    this.markAllAsRead(organizationId);
  }
}
